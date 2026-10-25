package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/DavyCools/expenseowl/internal/api"
	"github.com/DavyCools/expenseowl/internal/localization"
	"github.com/DavyCools/expenseowl/internal/storage"
)

var version = "dev"

func runServer(port int) {
	if err := localization.Load(); err != nil {
		log.Fatalf("Failed to load translations: %v", err)
	}
	storage, err := storage.InitializeStorage()
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer storage.Close()
	handler := api.NewHandler(storage)

	// Version Handler
	http.HandleFunc("/version", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			handler.HTTPError(w, "errors.method", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(version))
	})

	// UI Handlers
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			handler.HTTPError(w, "errors.notFound", http.StatusNotFound)
			return
		}
		handler.ServePage(w, r, "page-dashboard")
	})
	http.HandleFunc("/table", handler.ServeTableView)
	http.HandleFunc("/settings", handler.ServeSettingsPage)

	// Static File Handlers
	http.HandleFunc("/theme.js", handler.ServeStaticFile)
	http.HandleFunc("/manifest.json", handler.ServeStaticFile)
	http.HandleFunc("/sw.js", handler.ServeStaticFile)
	http.HandleFunc("/icons/", handler.ServeStaticFile)
	http.HandleFunc("icons/favicon.ico", handler.ServeStaticFile)
	http.HandleFunc("/chart.min.js", handler.ServeStaticFile)
	http.HandleFunc("/fa.min.css", handler.ServeStaticFile)
	http.HandleFunc("/webfonts/", handler.ServeStaticFile)
	http.HandleFunc("/pages/", handler.ServeStaticFile)
	http.HandleFunc("/components/", handler.ServeStaticFile)
	http.HandleFunc("/shared/", handler.ServeStaticFile)
	http.HandleFunc("/vendor/", handler.ServeStaticFile)
	http.HandleFunc("/locales/", handler.ServeLocales)

	// Config
	http.HandleFunc("/config", handler.GetConfig)
	http.HandleFunc("/categories", handler.GetCategories)
	http.HandleFunc("/categories/edit", handler.UpdateCategories)
	http.HandleFunc("/categories/rename", handler.RenameCategory)
	http.HandleFunc("/currency", handler.GetCurrency)
	http.HandleFunc("/currency/edit", handler.UpdateCurrency)
	http.HandleFunc("/startdate", handler.GetStartDate)
	http.HandleFunc("/startdate/edit", handler.UpdateStartDate)
	http.HandleFunc("/future-transactions/edit", handler.UpdateFutureTransactionsSettings)
	http.HandleFunc("/language/edit", handler.UpdateLanguage)
	// http.HandleFunc("/tags", handler.GetTags)
	// http.HandleFunc("/tags/edit", handler.UpdateTags)

	// Expenses
	http.HandleFunc("/expense", handler.AddExpense)                     // PUT for add
	http.HandleFunc("/expenses", handler.GetExpenses)                   // GET all
	http.HandleFunc("/expense/edit", handler.EditExpense)               // PUT for edit
	http.HandleFunc("/expense/delete", handler.DeleteExpense)           // DELETE for single
	http.HandleFunc("/expenses/delete", handler.DeleteMultipleExpenses) // DELETE for multiple

	// Recurring Expenses
	http.HandleFunc("/recurring-expense", handler.AddRecurringExpense)           // PUT for add
	http.HandleFunc("/recurring-expenses", handler.GetRecurringExpenses)         // GET all
	http.HandleFunc("/recurring-expense/edit", handler.UpdateRecurringExpense)   // PUT for edit
	http.HandleFunc("/recurring-expense/delete", handler.DeleteRecurringExpense) // DELETE

	// Import/Export
	http.HandleFunc("/export/csv", handler.ExportCSV)
	http.HandleFunc("/import/csv", handler.ImportCSV)

	log.Println("Starting server on port", port, "...")
	if err := http.ListenAndServe(fmt.Sprint(":", port), nil); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func main() {
	port := flag.Int("port", 8080, "Port to serve from")
	flag.Parse()
	runServer(*port)
}
