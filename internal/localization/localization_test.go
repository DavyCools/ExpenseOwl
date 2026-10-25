package localization

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"testing/fstest"
)

func TestCatalogs(t *testing.T) {
	if err := Load(); err != nil {
		t.Fatal(err)
	}
	for _, code := range []string{"en", "nl"} {
		if !Supported(code) {
			t.Fatalf("missing %s", code)
		}
	}
	text, err := Text("nl", "tags.create", map[string]any{"tag": "<script>"})
	if err != nil || text != `+ "<script>" aanmaken` {
		t.Fatalf("interpolation: %q %v", text, err)
	}
	if _, err := Text("en", "tags.create", nil); err == nil {
		t.Fatal("missing interpolation parameter accepted")
	}
	if _, err := Text("en", "missing.key", nil); err == nil {
		t.Fatal("missing key accepted")
	}
	if Normalize("") != "en" || Normalize("unsupported") != "en" {
		t.Fatal("English default/fallback not applied")
	}
}

func TestNewLanguageDiscoveredFromCatalog(t *testing.T) {
	english, err := files.ReadFile("locales/en.json")
	if err != nil {
		t.Fatal(err)
	}
	var extra Catalog
	if err := json.Unmarshal(english, &extra); err != nil {
		t.Fatal(err)
	}
	extra.Code, extra.Name, extra.Locale = "fr", "Français", "fr-FR"
	data, err := json.Marshal(extra)
	if err != nil {
		t.Fatal(err)
	}
	fixture := fstest.MapFS{
		"locales/en.json": {Data: english},
		"locales/fr.json": {Data: data},
	}
	result, err := readCatalogs(fixture)
	if err != nil || result["fr"].Name != "Français" {
		t.Fatalf("discovery failed: %v", err)
	}
	delete(extra.Translation, "common.save")
	data, _ = json.Marshal(extra)
	fixture["locales/fr.json"] = &fstest.MapFile{Data: data}
	if _, err := readCatalogs(fixture); err == nil || !strings.Contains(err.Error(), "common.save") {
		t.Fatalf("missing key did not fail validation: %v", err)
	}
}

func TestPlaceholderParity(t *testing.T) {
	english, _ := files.ReadFile("locales/en.json")
	var dutch Catalog
	if err := json.Unmarshal(english, &dutch); err != nil {
		t.Fatal(err)
	}
	dutch.Code, dutch.Name, dutch.Locale = "nl", "Nederlands", "nl-NL"
	dutch.Translation["tags.create"] = "{{wrong}}"
	data, _ := json.Marshal(dutch)
	if _, err := readCatalogs(fstest.MapFS{
		"locales/en.json": {Data: english},
		"locales/nl.json": {Data: data},
	}); err == nil || !strings.Contains(err.Error(), "placeholders") {
		t.Fatalf("placeholder mismatch accepted: %v", err)
	}
}

func TestReferencedKeysExist(t *testing.T) {
	catalog, err := GetCatalog("en")
	if err != nil {
		t.Fatal(err)
	}
	keys := regexp.MustCompile(`["']((?:common|navigation|page|controls|expense|tags|table|chart|settings|import|recurring|validation|errors|translations)\.[a-zA-Z][a-zA-Z0-9]*)["']`)
	for _, directory := range []string{"..", filepath.Join("..", "..", "cmd")} {
		if err := filepath.WalkDir(directory, func(name string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if entry.IsDir() {
				if entry.Name() == "vendor" {
					return filepath.SkipDir
				}
				return nil
			}
			ext := filepath.Ext(name)
			if (ext != ".go" && ext != ".html" && ext != ".js") || strings.HasSuffix(name, "_test.go") ||
				strings.HasSuffix(name, ".min.js") {
				return nil
			}
			source, err := os.ReadFile(name)
			if err != nil {
				return err
			}
			if ext == ".go" && regexp.MustCompile(`(?:ErrorResponse\{Error:|http\.Error\([^,]+,)\s*"`).Match(source) {
				t.Errorf("%s contains a hardcoded public error", name)
			}
			for _, match := range keys.FindAllSubmatch(source, -1) {
				if _, ok := catalog.Translation[string(match[1])]; !ok {
					t.Errorf("%s references missing key %s", name, match[1])
				}
			}
			return nil
		}); err != nil {
			t.Fatal(err)
		}
	}
}
