package main

import (
	"log"

	"github.com/elrefai99/Qar/package/cmd"
	"github.com/elrefai99/Qar/package/database"
)

func main() {
	db, err := database.ConnectDatabase()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	cmd.Execute(db)
}
