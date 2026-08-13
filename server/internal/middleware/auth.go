package middleware

import (
	"context"
	"net/http"

	"paddle-league/server/internal/auth"
)

type ctxKey string

const userIDKey ctxKey = "userID"

// RequireAuth reads the "pl_token" cookie, validates it, and stashes the
// user ID in the request context. Responds 401 on failure.
func RequireAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("pl_token")
			if err != nil {
				http.Error(w, `{"error":"unauthenticated"}`, http.StatusUnauthorized)
				return
			}
			claims, err := auth.ParseToken(secret, cookie.Value)
			if err != nil {
				http.Error(w, `{"error":"unauthenticated"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func UserID(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(userIDKey).(string)
	return v, ok
}
