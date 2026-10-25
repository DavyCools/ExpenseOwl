package api

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/DavyCools/expenseowl/internal/localization"
	"github.com/DavyCools/expenseowl/internal/storage"
	"github.com/DavyCools/expenseowl/internal/web"
)

// Handler holds the storage interface
type Handler struct {
	storage storage.Storage
}

// NewHandler creates a new API handler
func NewHandler(s storage.Storage) *Handler {
	return &Handler{
		storage: s,
	}
}

// ErrorResponse is a generic JSON error response
type ErrorResponse struct {
	Error  string         `json:"error"`
	Code   string         `json:"code"`
	Params map[string]any `json:"params,omitempty"`
}

func apiError(code string, params map[string]any) ErrorResponse {
	public := localization.NewError(code, params)
	return ErrorResponse{Error: public.Error(), Code: code, Params: params}
}

func publicError(err error, fallback string) ErrorResponse {
	var public *localization.PublicError
	if errors.As(err, &public) {
		return apiError(public.Code, public.Params)
	}
	log.Printf("API ERROR: %s: %v", fallback, err)
	return apiError(fallback, nil)
}

// writeJSON is a helper to write JSON responses
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		json.NewEncoder(w).Encode(v)
	}
}

// ------------------------------------------------------------
// Config Handlers
// ------------------------------------------------------------

func (h *Handler) GetConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	config, err := h.storage.GetConfig()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.configGet", nil))
		log.Printf("API ERROR: Failed to get config: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, config)
}

func (h *Handler) GetCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	categories, err := h.storage.GetCategories()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.categoriesGet", nil))
		log.Printf("API ERROR: Failed to get categories: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, categories)
}

func (h *Handler) UpdateCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	var categories []string
	if err := json.NewDecoder(r.Body).Decode(&categories); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.body", nil))
		return
	}
	var sanitizedCategories []string
	for _, category := range categories {
		sanitized, err := storage.ValidateCategory(category)
		if err != nil {
			log.Printf("API ERROR: Invalid category provided: %v\n", err)
			writeJSON(w, http.StatusBadRequest, apiError("errors.categoryInvalid", map[string]any{
				"category": category, "reason": "errors.categoryEmpty", "message": err.Error(),
			}))
			return
		}
		sanitizedCategories = append(sanitizedCategories, sanitized)
	}
	if err := h.storage.UpdateCategories(sanitizedCategories); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.categoriesUpdate", nil))
		log.Printf("API ERROR: Failed to update categories: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (h *Handler) RenameCategory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	var payload struct {
		OldName string `json:"oldName"`
		NewName string `json:"newName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.body", nil))
		return
	}

	newName, err := storage.ValidateCategory(payload.NewName)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.categoryNewInvalid", map[string]any{
			"reason": "errors.categoryEmpty", "message": err.Error(),
		}))
		return
	}

	categories, err := h.storage.GetCategories()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.categoriesGet", nil))
		log.Printf("API ERROR: Failed to get categories: %v\n", err)
		return
	}

	if !slices.Contains(categories, payload.OldName) {
		writeJSON(w, http.StatusBadRequest, apiError("errors.categoryMissing", nil))
		return
	}

	if payload.OldName != newName && slices.Contains(categories, newName) {
		writeJSON(w, http.StatusBadRequest, apiError("errors.categoryExists", nil))
		return
	}

	if i := slices.Index(categories, payload.OldName); i != -1 {
		categories[i] = newName
	}

	expenses, err := h.storage.GetAllExpenses()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.expensesGet", nil))
		log.Printf("API ERROR: Failed to get expenses: %v\n", err)
		return
	}

	for i := range expenses {
		if expenses[i].Category == payload.OldName {
			expenses[i].Category = newName
			if err := h.storage.UpdateExpense(expenses[i].ID, expenses[i]); err != nil {
				writeJSON(w, http.StatusInternalServerError, apiError("errors.expenseUpdate", nil))
				log.Printf("API ERROR: Failed to update expense %s: %v\n", expenses[i].ID, err)
				return
			}
		}
	}

	recurringExpenses, err := h.storage.GetRecurringExpenses()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.recurringGet", nil))
		log.Printf("API ERROR: Failed to get recurring expenses: %v\n", err)
		return
	}

	for i := range recurringExpenses {
		if recurringExpenses[i].Category == payload.OldName {
			recurringExpenses[i].Category = newName
			if err := h.storage.UpdateRecurringExpense(recurringExpenses[i].ID, recurringExpenses[i], false); err != nil {
				writeJSON(w, http.StatusInternalServerError, apiError("errors.recurringUpdate", nil))
				log.Printf("API ERROR: Failed to update recurring expense %s: %v\n", recurringExpenses[i].ID, err)
				return
			}
		}
	}

	if err := h.storage.UpdateCategories(categories); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.categoriesUpdate", nil))
		log.Printf("API ERROR: Failed to update categories: %v\n", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (h *Handler) GetCurrency(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	currency, err := h.storage.GetCurrency()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.currencyGet", nil))
		log.Printf("API ERROR: Failed to get currency: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, currency)
}

func (h *Handler) UpdateCurrency(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	var currency string
	if err := json.NewDecoder(r.Body).Decode(&currency); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.body", nil))
		return
	}
	if err := h.storage.UpdateCurrency(currency); err != nil {
		writeJSON(w, http.StatusInternalServerError, publicError(err, "errors.currencySave"))
		log.Printf("API ERROR: Failed to update currency: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (h *Handler) UpdateFutureTransactionsSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	var settings struct {
		ShowSwitch       *bool `json:"showFutureTransactions"`
		IncludeByDefault *bool `json:"includeFutureTransactions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.body", nil))
		return
	}
	if settings.ShowSwitch == nil || settings.IncludeByDefault == nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.futureRequired", nil))
		return
	}
	if err := h.storage.UpdateFutureTransactionsSettings(*settings.ShowSwitch, *settings.IncludeByDefault); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.futureSave", nil))
		log.Printf("API ERROR: Failed to save future transaction settings: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (h *Handler) GetStartDate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	startDate, err := h.storage.GetStartDate()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.startDateGet", nil))
		log.Printf("API ERROR: Failed to get start date: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, startDate)
}

func (h *Handler) UpdateStartDate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	var startDate int
	if err := json.NewDecoder(r.Body).Decode(&startDate); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.body", nil))
		return
	}
	if err := h.storage.UpdateStartDate(startDate); err != nil {
		writeJSON(w, http.StatusInternalServerError, publicError(err, "errors.startDateSave"))
		log.Printf("API ERROR: Failed to update start date: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

// ------------------------------------------------------------
// Expense Handlers
// ------------------------------------------------------------

func (h *Handler) AddExpense(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	var expense storage.Expense
	if err := json.NewDecoder(r.Body).Decode(&expense); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.body", nil))
		return
	}
	if err := expense.Validate(); err != nil {
		writeJSON(w, http.StatusBadRequest, publicError(err, "errors.expenseSave"))
		return
	}
	if expense.Date.IsZero() {
		expense.Date = time.Now()
	}
	if err := h.storage.AddExpense(expense); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.expenseSave", nil))
		log.Printf("API ERROR: Failed to save expense: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, expense)
}

func (h *Handler) GetExpenses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	expenses, err := h.storage.GetAllExpenses()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.expensesRetrieve", nil))
		log.Printf("API ERROR: Failed to retrieve expenses: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, expenses)
}

func (h *Handler) EditExpense(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, apiError("errors.id", nil))
		return
	}
	var expense storage.Expense
	if err := json.NewDecoder(r.Body).Decode(&expense); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.body", nil))
		return
	}
	if err := expense.Validate(); err != nil {
		writeJSON(w, http.StatusBadRequest, publicError(err, "errors.expenseEdit"))
		return
	}
	if err := h.storage.UpdateExpense(id, expense); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.expenseEdit", nil))
		log.Printf("API ERROR: Failed to edit expense: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, expense)
}

func (h *Handler) DeleteExpense(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, apiError("errors.id", nil))
		return
	}
	if err := h.storage.RemoveExpense(id); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.expenseDelete", nil))
		log.Printf("API ERROR: Failed to delete expense: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (h *Handler) DeleteMultipleExpenses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	var payload struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.body", nil))
		return
	}
	if err := h.storage.RemoveMultipleExpenses(payload.IDs); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.expensesDelete", nil))
		log.Printf("API ERROR: Failed to delete multiple expenses: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

// ------------------------------------------------------------
// Recurring Expense Handlers
// ------------------------------------------------------------

func (h *Handler) AddRecurringExpense(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	var re storage.RecurringExpense
	if err := json.NewDecoder(r.Body).Decode(&re); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.body", nil))
		return
	}
	if err := re.Validate(); err != nil {
		writeJSON(w, http.StatusBadRequest, publicError(err, "errors.recurringAdd"))
		return
	}
	if err := h.storage.AddRecurringExpense(re); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.recurringAdd", nil))
		log.Printf("API ERROR: Failed to add recurring expense: %v\n", err)
		return
	}
	writeJSON(w, http.StatusCreated, re)
}

func (h *Handler) GetRecurringExpenses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	res, err := h.storage.GetRecurringExpenses()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.recurringGet", nil))
		log.Printf("API ERROR: Failed to get recurring expenses: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *Handler) UpdateRecurringExpense(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, apiError("errors.id", nil))
		return
	}
	updateAll, _ := strconv.ParseBool(r.URL.Query().Get("updateAll"))

	var re storage.RecurringExpense
	if err := json.NewDecoder(r.Body).Decode(&re); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.body", nil))
		return
	}
	if err := re.Validate(); err != nil {
		writeJSON(w, http.StatusBadRequest, publicError(err, "errors.recurringUpdate"))
		return
	}
	if err := h.storage.UpdateRecurringExpense(id, re, updateAll); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.recurringUpdate", nil))
		log.Printf("API ERROR: Failed to update recurring expense: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (h *Handler) DeleteRecurringExpense(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, apiError("errors.id", nil))
		return
	}
	removeAll, _ := strconv.ParseBool(r.URL.Query().Get("removeAll"))

	if err := h.storage.RemoveRecurringExpense(id, removeAll); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiError("errors.recurringDelete", nil))
		log.Printf("API ERROR: Failed to delete recurring expense: %v\n", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

// ------------------------------------------------------------
// Static and UI Handlers
// ------------------------------------------------------------

func (h *Handler) ServeTableView(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	h.ServePage(w, r, "page-table")
}

func (h *Handler) ServeSettingsPage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	h.ServePage(w, r, "page-settings")
}

func (h *Handler) ServeStaticFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	if err := web.ServeStatic(w, r.URL.Path); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			h.HTTPError(w, "errors.notFound", http.StatusNotFound)
			return
		}
		log.Printf("HTTP ERROR: Failed to serve static file: %v", err)
		h.HTTPError(w, "errors.asset", http.StatusInternalServerError)
	}
}

func (h *Handler) language() string {
	config, err := h.storage.GetConfig()
	if err != nil {
		log.Printf("LOCALIZATION ERROR: failed to read page language: %v; using English", err)
		return "en"
	}
	return localization.Normalize(config.Language)
}

func (h *Handler) HTTPError(w http.ResponseWriter, key string, status int) {
	text, err := localization.Text(h.language(), key, nil)
	if err != nil {
		log.Printf("LOCALIZATION ERROR: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	http.Error(w, text, status)
}

func (h *Handler) ServePage(w http.ResponseWriter, r *http.Request, page string) {
	if r.Method != http.MethodGet {
		h.HTTPError(w, "errors.method", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "text/html")
	w.Header().Set("Cache-Control", "no-store")
	if err := web.ServeTemplate(w, page, h.language()); err != nil {
		log.Printf("HTTP ERROR: failed to serve page: %v", err)
		h.HTTPError(w, "errors.page", http.StatusInternalServerError)
	}
}

func (h *Handler) UpdateLanguage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	var language string
	if err := json.NewDecoder(r.Body).Decode(&language); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError("errors.body", nil))
		return
	}
	if !localization.Supported(language) {
		writeJSON(w, http.StatusBadRequest, apiError("errors.language", map[string]any{"language": language}))
		return
	}
	if err := h.storage.UpdateLanguage(language); err != nil {
		log.Printf("API ERROR: failed to save language: %v", err)
		writeJSON(w, http.StatusInternalServerError, publicError(err, "errors.languageSave"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func (h *Handler) ServeLocales(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, apiError("errors.method", nil))
		return
	}
	if r.URL.Path == "/locales/" {
		languages, err := localization.Languages()
		if err != nil {
			log.Printf("LOCALIZATION ERROR: %v", err)
			h.HTTPError(w, "errors.asset", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, languages)
		return
	}
	code := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/locales/"), ".json")
	if r.URL.Path != "/locales/"+code+".json" || !localization.Supported(code) {
		h.HTTPError(w, "errors.notFound", http.StatusNotFound)
		return
	}
	catalog, err := localization.GetCatalog(code)
	if err != nil {
		log.Printf("LOCALIZATION ERROR: %v", err)
		h.HTTPError(w, "errors.asset", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, catalog)
}
