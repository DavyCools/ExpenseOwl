package localization

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"regexp"
	"sort"
	"strings"
	"sync"
)

//go:embed locales/*.json
var files embed.FS

type Catalog struct {
	Code        string            `json:"code"`
	Name        string            `json:"name"`
	Locale      string            `json:"locale"`
	Translation map[string]string `json:"translation"`
}

type Language struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

var once sync.Once
var catalogs map[string]Catalog
var loadError error
var placeholders = regexp.MustCompile(`\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}`)
var languageCode = regexp.MustCompile(`^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$`)

func Load() error {
	once.Do(func() { catalogs, loadError = readCatalogs(files) })
	return loadError
}

func readCatalogs(source fs.FS) (map[string]Catalog, error) {
	names, err := fs.Glob(source, "locales/*.json")
	if err != nil {
		return nil, err
	}
	result := make(map[string]Catalog)
	for _, name := range names {
		data, err := fs.ReadFile(source, name)
		if err != nil {
			return nil, err
		}
		var catalog Catalog
		if err := json.Unmarshal(data, &catalog); err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
		if !languageCode.MatchString(catalog.Code) || name != "locales/"+catalog.Code+".json" ||
			catalog.Name == "" || catalog.Locale == "" || len(catalog.Translation) == 0 {
			return nil, fmt.Errorf("invalid catalog metadata: %s", name)
		}
		result[catalog.Code] = catalog
	}
	english, ok := result["en"]
	if !ok {
		return nil, fmt.Errorf("English catalog is required")
	}
	for code, catalog := range result {
		for key, text := range english.Translation {
			value, ok := catalog.Translation[key]
			if !ok || value == "" {
				return nil, fmt.Errorf("%s: missing translation %s", code, key)
			}
			if placeholderNames(text) != placeholderNames(value) {
				return nil, fmt.Errorf("%s: inconsistent placeholders for %s", code, key)
			}
		}
		for key := range catalog.Translation {
			if _, ok := english.Translation[key]; !ok {
				// Additional CLDR plural forms are allowed for languages with more forms.
				base := regexp.MustCompile(`_(zero|one|two|few|many|other)$`).ReplaceAllString(key, "")
				if _, plural := english.Translation[base+"_other"]; !plural {
					return nil, fmt.Errorf("%s: unknown translation %s", code, key)
				}
			}
		}
	}
	return result, nil
}

func placeholderNames(text string) string {
	var names []string
	for _, match := range placeholders.FindAllStringSubmatch(text, -1) {
		names = append(names, match[1])
	}
	sort.Strings(names)
	return strings.Join(names, ",")
}

func Supported(code string) bool {
	return Load() == nil && catalogs[code].Code != ""
}

func Normalize(code string) string {
	if code == "" {
		return "en"
	}
	if !Supported(code) {
		log.Printf("LOCALIZATION ERROR: unsupported persisted language %q; using English", code)
		return "en"
	}
	return code
}

func Languages() ([]Language, error) {
	if err := Load(); err != nil {
		return nil, err
	}
	var result []Language
	for _, catalog := range catalogs {
		result = append(result, Language{Code: catalog.Code, Name: catalog.Name})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Code < result[j].Code })
	return result, nil
}

func GetCatalog(code string) (Catalog, error) {
	if err := Load(); err != nil {
		return Catalog{}, err
	}
	catalog, ok := catalogs[code]
	if !ok {
		return Catalog{}, fmt.Errorf("unknown language %q", code)
	}
	return catalog, nil
}

func Text(language, key string, params map[string]any) (string, error) {
	if err := Load(); err != nil {
		return "", err
	}
	catalog := catalogs[Normalize(language)]
	text, ok := catalog.Translation[key]
	if !ok {
		log.Printf("LOCALIZATION ERROR: missing %s translation %s; trying English", language, key)
		text, ok = catalogs["en"].Translation[key]
	}
	if !ok {
		return "", fmt.Errorf("missing English translation %q", key)
	}
	var missing string
	text = placeholders.ReplaceAllStringFunc(text, func(token string) string {
		name := placeholders.FindStringSubmatch(token)[1]
		value, ok := params[name]
		if !ok {
			missing = name
			return token
		}
		return fmt.Sprint(value)
	})
	if missing != "" {
		return "", fmt.Errorf("missing interpolation parameter %q for %s", missing, key)
	}
	return text, nil
}

// PublicError keeps protocol identifiers separate from translated presentation.
type PublicError struct {
	Code   string         `json:"code"`
	Params map[string]any `json:"params,omitempty"`
}

func NewError(code string, params map[string]any) *PublicError {
	return &PublicError{Code: code, Params: params}
}

func (e *PublicError) Error() string {
	text, err := Text("en", e.Code, e.Params)
	if err != nil {
		log.Printf("LOCALIZATION ERROR: %v", err)
		return e.Code
	}
	return text
}
