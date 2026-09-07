package utils

import (
	"fmt"
	"os"

	"github.com/resend/resend-go/v3"
)

func SendEmails(email string) error {
	client := resend.NewClient(os.Getenv("RESEND_API_KEY"))

	params := &resend.SendEmailRequest{
		From:    "Acme <onboarding@resend.dev>",
		To:      []string{email},
		Html:    "<strong>hello world</strong>",
		Subject: "Hello from Golang",
	}

	sent, err := client.Emails.Send(params)
	if err != nil {
		return err
	}
	fmt.Println(sent.Id)
	return nil
}
