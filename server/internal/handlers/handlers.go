package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// API bundles shared dependencies for all HTTP handlers.
type API struct {
	DB               *pgxpool.Pool
	JWTSecret        string
	Prod             bool // controls cookie Secure flag
	CrossSiteCookies bool // see config.Config.CrossSiteCookies
}

func (a *API) cookieSameSite() http.SameSite {
	if a.CrossSiteCookies {
		return http.SameSiteNoneMode
	}
	return http.SameSiteLaxMode
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func (a *API) setAuthCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "pl_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   a.Prod || a.CrossSiteCookies, // SameSite=None requires Secure regardless of Prod
		SameSite: a.cookieSameSite(),
		Expires:  time.Now().Add(30 * 24 * time.Hour),
	})
}

func (a *API) clearAuthCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "pl_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   a.Prod || a.CrossSiteCookies,
		SameSite: a.cookieSameSite(),
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}
