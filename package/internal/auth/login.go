package auth

import (
	"database/sql"
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func LoginService(db *sql.DB, payload LoginRequest) (string, error) {
	defer db.Close()
	var (
		userID   string
		password string
	)
	selectQuery := "select uid, password from users where email=$1"
	err := db.QueryRow(selectQuery, payload.Email).Scan(&userID, &password)
	if err != nil {
		return "", err
	}
	if err := bcrypt.CompareHashAndPassword(
		[]byte(password),
		[]byte(payload.Password),
	); err != nil {
		return "", errors.New("invalid email or password")
	}

	claims := jwt.MapClaims{
		"sub":   userID,
		"email": payload.Email,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signedToken, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return "", err
	}

	return signedToken, nil
}
