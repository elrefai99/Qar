package cmd

import (
	"database/sql"
	"log"

	"github.com/elrefai99/Qar/package/internal/auth"
	"github.com/elrefai99/Qar/package/utils"
	"github.com/spf13/cobra"
)

func NewLoginCommand(db *sql.DB) *cobra.Command {
	return &cobra.Command{
		Use: "login",
		Run: func(cmd *cobra.Command, args []string) {
			email := utils.ReadLine("Please enter email: ")
			password := utils.ReadLine("Please enter password: ")
			token, err := auth.LoginService(db, auth.LoginRequest{
				Email:    email,
				Password: password,
			})
			if err != nil {
				log.Println(err)
				return
			}

			emailResult := make(chan error, 1)
			go func() {
				emailResult <- utils.SendEmails(email)
			}()

			if err := <-emailResult; err != nil {
				log.Println("email failed:", err)
			}

			if err := saveToken(token); err != nil {
				log.Println(err)
				return
			}

			log.Println("Login successful")
		},
	}
}
