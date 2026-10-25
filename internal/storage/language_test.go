package storage

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/DavyCools/expenseowl/internal/localization"
)

func TestJSONLanguage(t *testing.T) {
	directory := t.TempDir()
	store, err := InitializeJsonStore(SystemConfig{StorageURL: directory})
	if err != nil {
		t.Fatal(err)
	}
	config, err := store.GetConfig()
	if err != nil || config.Language != "en" {
		t.Fatalf("new config: %v %+v", err, config)
	}
	// Simulate configuration written before language preferences existed.
	configMap := map[string]any{}
	data, _ := os.ReadFile(filepath.Join(directory, "config.json"))
	if err := json.Unmarshal(data, &configMap); err != nil {
		t.Fatal(err)
	}
	delete(configMap, "language")
	data, _ = json.Marshal(configMap)
	if err := os.WriteFile(filepath.Join(directory, "config.json"), data, 0600); err != nil {
		t.Fatal(err)
	}
	config, err = store.GetConfig()
	if err != nil || config.Language != "en" {
		t.Fatalf("old config: %v %+v", err, config)
	}
	if err := store.UpdateLanguage("nl"); err != nil {
		t.Fatal(err)
	}
	if err := store.UpdateCurrency("eur"); err != nil {
		t.Fatal(err)
	}
	reopened, err := InitializeJsonStore(SystemConfig{StorageURL: directory})
	if err != nil {
		t.Fatal(err)
	}
	config, err = reopened.GetConfig()
	if err != nil || config.Language != "nl" || config.Currency != "eur" || config.Categories[0] != "Food" {
		t.Fatalf("roundtrip: %v %+v", err, config)
	}
	var public *localization.PublicError
	if err := store.UpdateLanguage("../en"); !errors.As(err, &public) || public.Code != "errors.language" {
		t.Fatalf("invalid language accepted: %v", err)
	}
	config, _ = store.GetConfig()
	if config.Language != "nl" {
		t.Fatal("failed update changed language")
	}
}
