package web

import (
	"errors"
	"io/fs"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

func TestComposedPages(t *testing.T) {
	for _, page := range []string{"dashboard", "table", "settings"} {
		t.Run(page, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			if err := ServeTemplate(recorder, "page-"+page); err != nil {
				t.Fatal(err)
			}
			html := recorder.Body.String()
			for _, expected := range []string{"<!DOCTYPE html>", "ExpenseOwl", "navigation-logo", `id="option-template"`, `type="module"`, "/pages/" + page + "/" + page + ".js"} {
				if !strings.Contains(html, expected) {
					t.Errorf("missing %q", expected)
				}
			}
			if strings.Contains(html, "{{") {
				t.Error("unrendered Go template")
			}
			for _, match := range regexp.MustCompile(`(?:src|href)="([^"]+\.(?:js|css))"`).FindAllStringSubmatch(html, -1) {
				if err := ServeStatic(httptest.NewRecorder(), match[1]); err != nil {
					t.Errorf("page references unavailable asset %s: %v", match[1], err)
				}
			}
		})
	}
}

func TestRenderFailureDoesNotWritePartialPage(t *testing.T) {
	recorder := httptest.NewRecorder()
	if err := ServeTemplate(recorder, "unknown-page"); err == nil {
		t.Fatal("expected render error")
	}
	if recorder.Body.Len() != 0 {
		t.Fatal("render failure wrote a partial page")
	}
}

func TestEmbeddedAssets(t *testing.T) {
	if err := fs.WalkDir(content, "templates", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || (!strings.HasSuffix(name, ".js") && !strings.HasSuffix(name, ".css")) {
			return nil
		}
		recorder := httptest.NewRecorder()
		if err := ServeStatic(recorder, strings.TrimPrefix(name, "templates")); err != nil {
			t.Errorf("%s: %v", name, err)
		}
		wantType := "text/css"
		if strings.HasSuffix(name, ".js") {
			wantType = "application/javascript"
		}
		if recorder.Header().Get("Content-Type") != wantType {
			t.Errorf("%s: incorrect content type", name)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"/shared/missing.js", "/pages/table/table.html", "/../go.mod", "/shared/../theme.js"} {
		if err := ServeStatic(httptest.NewRecorder(), name); !errors.Is(err, fs.ErrNotExist) {
			t.Errorf("expected missing asset for %q, got %v", name, err)
		}
	}
}

func TestMarkupAndBehaviorStaySeparated(t *testing.T) {
	inlineScript := regexp.MustCompile(`(?is)<script\b[^>]*>\s*[^<\s]`)
	inlineHandler := regexp.MustCompile(`(?i)\s+on[a-z]+\s*=`)
	markupString := regexp.MustCompile("(?s)[`'\"]\\s*<(?:div|span|tr|td|table|option|button|i|p|label)\\b")
	if err := fs.WalkDir(content, "templates", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || strings.HasSuffix(name, "chart.min.js") {
			return nil
		}
		source, err := content.ReadFile(name)
		if err != nil {
			return err
		}
		if strings.HasSuffix(name, ".html") {
			if inlineScript.Match(source) || inlineHandler.Match(source) {
				t.Errorf("%s contains inline JavaScript", name)
			}
		}
		if strings.HasSuffix(name, ".js") && markupString.Match(source) {
			t.Errorf("%s contains generated HTML markup", name)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}
