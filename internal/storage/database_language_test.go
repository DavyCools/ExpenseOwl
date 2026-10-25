package storage

import (
	"database/sql"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestPostgresLanguageMigrationAndRoundtrip(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, query := range []string{createExpensesTableSQL, createRecurringExpensesTableSQL,
		createConfigTableSQL, migrateFutureTransactionsSettingsSQL, migrateLanguageSQL} {
		mock.ExpectExec(query).WillReturnResult(sqlmock.NewResult(0, 0))
	}
	if err := createTables(db); err != nil {
		t.Fatal(err)
	}
	store := &databaseStore{db: db, defaults: map[string]string{}}
	configQuery := `SELECT categories, currency, start_date, show_future_transactions, include_future_transactions, language FROM config WHERE id = 'default'`
	saveQuery := `INSERT INTO config (id, categories, currency, start_date, show_future_transactions, include_future_transactions, language)
		VALUES ('default', $1, $2, $3, $4, $5, $6)
		ON CONFLICT (id) DO UPDATE SET
			categories = EXCLUDED.categories,
			currency = EXCLUDED.currency,
			start_date = EXCLUDED.start_date,
			show_future_transactions = EXCLUDED.show_future_transactions,
			include_future_transactions = EXCLUDED.include_future_transactions,
			language = EXCLUDED.language;`
	columns := []string{"categories", "currency", "start_date", "show_future_transactions", "include_future_transactions", "language"}
	mock.ExpectQuery(configQuery).WillReturnError(sql.ErrNoRows)
	mock.ExpectExec(saveQuery).WithArgs(`["Food","Groceries","Travel","Rent","Utilities","Entertainment","Healthcare","Shopping","Miscellaneous","Income"]`,
		"usd", 1, true, false, "en").WillReturnResult(sqlmock.NewResult(1, 1))
	config, err := store.GetConfig()
	if err != nil || config.Language != "en" {
		t.Fatalf("initial config: %v %+v", err, config)
	}
	recurringQuery := `SELECT id, name, amount, currency, category, start_date, interval, occurrences, tags FROM recurring_expenses`
	recurringColumns := []string{"id", "name", "amount", "currency", "category", "start_date", "interval", "occurrences", "tags"}
	for _, language := range []string{"en", "nl"} {
		mock.ExpectQuery(configQuery).WillReturnRows(sqlmock.NewRows(columns).AddRow(`["Food"]`, "eur", 5, false, true, language))
		mock.ExpectQuery(recurringQuery).WillReturnRows(sqlmock.NewRows(recurringColumns))
		if language == "en" {
			mock.ExpectExec(saveQuery).WithArgs(`["Food"]`, "eur", 5, false, true, "nl").WillReturnResult(sqlmock.NewResult(1, 1))
			if err := store.UpdateLanguage("nl"); err != nil {
				t.Fatal(err)
			}
		} else {
			config, err := store.GetConfig()
			if err != nil || config.Language != "nl" || config.Currency != "eur" || config.StartDate != 5 {
				t.Fatalf("roundtrip: %v %+v", err, config)
			}
		}
	}
	if err := store.UpdateLanguage("invalid"); err == nil {
		t.Fatal("invalid language accepted")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
