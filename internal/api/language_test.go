package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DavyCools/expenseowl/internal/storage"
)

func TestLanguageAPIAndRendering(t *testing.T) {
	store, err := storage.InitializeJsonStore(storage.SystemConfig{StorageURL: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	handler := NewHandler(store)
	for _, body := range []string{`"nl"`, `"en"`, `"nl"`} {
		recorder := httptest.NewRecorder()
		handler.UpdateLanguage(recorder, httptest.NewRequest(http.MethodPut, "/language/edit", strings.NewReader(body)))
		if recorder.Code != http.StatusOK {
			t.Fatalf("save: %s", recorder.Body)
		}
	}
	for _, body := range []string{`"xx"`, `null`, `{}`} {
		recorder := httptest.NewRecorder()
		handler.UpdateLanguage(recorder, httptest.NewRequest(http.MethodPut, "/language/edit", strings.NewReader(body)))
		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("invalid body accepted: %s", body)
		}
		var response ErrorResponse
		if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil || response.Code == "" || response.Error == "" {
			t.Fatalf("missing compatible public error: %v %+v", err, response)
		}
	}
	for _, page := range []string{"dashboard", "table", "settings"} {
		recorder := httptest.NewRecorder()
		handler.ServePage(recorder, httptest.NewRequest(http.MethodGet, "/", nil), "page-"+page)
		if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `lang="nl"`) ||
			!strings.Contains(recorder.Body.String(), "Instellingen") {
			t.Fatalf("Dutch page %s: %d %s", page, recorder.Code, recorder.Body)
		}
	}
	recorder := httptest.NewRecorder()
	handler.AddExpense(recorder, httptest.NewRequest(http.MethodPut, "/expense", strings.NewReader(`{}`)))
	var response ErrorResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil || response.Code != "errors.expenseName" ||
		response.Error != "expense 'name' cannot be empty" {
		t.Fatalf("validation not coded/compatible: %v %+v", err, response)
	}
	for _, url := range []string{"/locales/", "/locales/en.json", "/locales/nl.json"} {
		recorder = httptest.NewRecorder()
		handler.ServeLocales(recorder, httptest.NewRequest(http.MethodGet, url, nil))
		if recorder.Code != http.StatusOK || !json.Valid(recorder.Body.Bytes()) {
			t.Fatalf("catalog %s: %d", url, recorder.Code)
		}
	}
	recorder = httptest.NewRecorder()
	handler.ServeLocales(recorder, httptest.NewRequest(http.MethodGet, "/locales/../en.json", nil))
	if recorder.Code != http.StatusNotFound {
		t.Fatal("unclean catalog path accepted")
	}
}
