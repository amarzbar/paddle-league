package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"paddle-league/server/internal/auth"
	"paddle-league/server/internal/middleware"
	"paddle-league/server/internal/models"
)

// Avatar colors deliberately steer clear of green (reserved for the brand's
// primary/win signal) while staying dark/saturated enough for readable white
// initials.
var avatarPalette = []string{
	"#2563EB", "#DB2777", "#B45309", "#0D9488", "#7C3AED",
	"#DC2626", "#475569", "#E11D48", "#0891B2", "#4F46E5",
}

func pickAvatarColor(seed string) string {
	sum := 0
	for _, c := range seed {
		sum += int(c)
	}
	return avatarPalette[sum%len(avatarPalette)]
}

type registerReq struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

func (a *API) Register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if req.Email == "" || len(req.Password) < 8 || req.DisplayName == "" {
		writeErr(w, http.StatusBadRequest, "email, displayName and a password of 8+ characters are required")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not hash password")
		return
	}

	var u models.User
	err = a.DB.QueryRow(r.Context(), `
		INSERT INTO users (email, password_hash, display_name, avatar_color)
		VALUES ($1, $2, $3, $4)
		RETURNING id, email, display_name, avatar_color, created_at
	`, req.Email, hash, req.DisplayName, pickAvatarColor(req.Email)).
		Scan(&u.ID, &u.Email, &u.DisplayName, &u.AvatarColor, &u.CreatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			writeErr(w, http.StatusConflict, "an account with that email already exists")
			return
		}
		writeErr(w, http.StatusInternalServerError, "could not create account")
		return
	}

	token, err := auth.IssueToken(a.JWTSecret, u.ID, 30*24*time.Hour)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not issue token")
		return
	}
	a.setAuthCookie(w, token)
	writeJSON(w, http.StatusCreated, u)
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (a *API) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var u models.User
	var hash string
	err := a.DB.QueryRow(r.Context(), `
		SELECT id, email, display_name, avatar_color, created_at, password_hash
		FROM users WHERE email = $1
	`, req.Email).Scan(&u.ID, &u.Email, &u.DisplayName, &u.AvatarColor, &u.CreatedAt, &hash)
	if err != nil || !auth.CheckPassword(hash, req.Password) {
		writeErr(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, err := auth.IssueToken(a.JWTSecret, u.ID, 30*24*time.Hour)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not issue token")
		return
	}
	a.setAuthCookie(w, token)
	writeJSON(w, http.StatusOK, u)
}

func (a *API) Logout(w http.ResponseWriter, r *http.Request) {
	a.clearAuthCookie(w)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) Me(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserID(r.Context())
	u, err := a.getUser(r.Context(), userID)
	if err != nil {
		writeErr(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (a *API) getUser(ctx context.Context, id string) (*models.User, error) {
	var u models.User
	err := a.DB.QueryRow(ctx, `
		SELECT id, email, display_name, avatar_color, created_at FROM users WHERE id = $1
	`, id).Scan(&u.ID, &u.Email, &u.DisplayName, &u.AvatarColor, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}
