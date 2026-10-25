package web

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"path"
	"path/filepath"
	"strings"
	"sync"

	"github.com/DavyCools/expenseowl/internal/localization"
)

//go:embed templates
var content embed.FS
var pageTemplates *template.Template
var templateError error
var parseOnce sync.Once

func parseTemplates() {
	var files []string
	templateError = fs.WalkDir(content, "templates", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() && strings.HasSuffix(name, ".html") {
			files = append(files, name)
		}
		return nil
	})
	if templateError == nil {
		pageTemplates, templateError = template.New("pages").ParseFS(content, files...)
	}
}

func GetTemplates() *embed.FS {
	return &content
}

type PageContext struct {
	Language string
	Active   string
}

func (p PageContext) T(key string) (string, error) {
	return localization.Text(p.Language, key, nil)
}

func (p PageContext) ForPage(active string) PageContext {
	p.Active = active
	return p
}

func ServeTemplate(w http.ResponseWriter, templateName string, language ...string) error {
	parseOnce.Do(parseTemplates)
	if templateError != nil {
		return templateError
	}
	var output bytes.Buffer
	selected := "en"
	if len(language) > 0 {
		selected = localization.Normalize(language[0])
	}
	if err := pageTemplates.ExecuteTemplate(&output, templateName, PageContext{Language: selected}); err != nil {
		return err
	}
	_, err := w.Write(output.Bytes())
	return err
}

func ServeStatic(w http.ResponseWriter, staticPath string) error {
	if path.Clean(staticPath) != staticPath || !strings.HasPrefix(staticPath, "/") {
		return fs.ErrNotExist
	}
	ext := filepath.Ext(staticPath)
	if ext != ".js" && ext != ".css" && ext != ".woff" && ext != ".woff2" &&
		ext != ".ttf" && ext != ".eot" && ext != ".svg" && ext != ".png" &&
		ext != ".ico" && ext != ".json" {
		return fmt.Errorf("%w: unsupported asset type", fs.ErrNotExist)
	}
	staticContent, err := content.ReadFile("templates" + staticPath)
	if err != nil {
		return err
	}
	switch ext {
	case ".js":
		w.Header().Set("Content-Type", "application/javascript")
	case ".css":
		w.Header().Set("Content-Type", "text/css")
	case ".woff", ".woff2":
		w.Header().Set("Content-Type", "font/"+ext[1:])
	case ".ttf":
		w.Header().Set("Content-Type", "font/ttf")
	case ".eot":
		w.Header().Set("Content-Type", "application/vnd.ms-fontobject")
	case ".svg":
		w.Header().Set("Content-Type", "image/svg+xml")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".ico":
		w.Header().Set("Content-Type", "image/x-icon")
	case ".json":
		w.Header().Set("Content-Type", "application/json")
	}
	_, err = w.Write(staticContent)
	return err
}
