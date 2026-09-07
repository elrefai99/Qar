package auth

import (
	"database/sql"
	"errors"

	"github.com/elrefai99/Qar/package/utils"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Display_name string `json:"display_name"`
	Email        string `json:"email"`
	Password     string `json:"password"`
}

func RegisterService(db *sql.DB, payload RegisterRequest) error {
	var userID string

	err := db.QueryRow(
		"SELECT uid FROM users WHERE email = $1",
		payload.Email,
	).Scan(&userID)
	if err == nil {
		return errors.New("email already used")
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword(
		[]byte(payload.Password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return err
	}

	uid, _ := utils.NewUUID()

	_, err = db.Exec(
		`INSERT INTO users (uid, display_name, email, password)
		 VALUES ($1, $2, $3, $4)`,
		uid,
		payload.Display_name,
		payload.Email,
		string(hashedPassword),
	)
	return err
}
