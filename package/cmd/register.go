package cmd

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	"github.com/elrefai99/Qar/package/internal/auth"
	"github.com/elrefai99/Qar/package/utils"
	"github.com/spf13/cobra"
)

func saveToken(token string) error {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return err
	}

	appDir := filepath.Join(configDir, "qar")
	if err := os.MkdirAll(appDir, 0700); err != nil {
		return err
	}

	tokenPath := filepath.Join(appDir, "token")
	return os.WriteFile(tokenPath, []byte(token), 0600)
}

func NewRegisterCommand(db *sql.DB) *cobra.Command {
	return &cobra.Command{
		Use: "register",
		Run: func(cmd *cobra.Command, args []string) {
			displayName := utils.ReadLine("Please enter display name: ")
			email := utils.ReadLine("Please enter email: ")
			password := utils.ReadLine("Please enter password: ")
			err := auth.RegisterService(db, auth.RegisterRequest{
				Display_name: displayName,
				Email:        email,
				Password:     password,
			})
			if err != nil {
				log.Println(err)
				return
			}

			log.Println("Registration successful")
		},
	}
}
