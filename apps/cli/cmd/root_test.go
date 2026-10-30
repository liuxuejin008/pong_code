package cmd_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	clipkg "github.com/liuxuejin008/pong_code/apps/cli/cmd"
	"github.com/liuxuejin008/pong_code/apps/cli/internal/config"
)

func runCommand(t *testing.T, stdin *os.File, args ...string) (string, error) {
	t.Helper()

	reader := os.Stdin
	if stdin != nil {
		os.Stdin = stdin
	}
	originalStdout := os.Stdout
	readFile, writeFile, err := os.Pipe()
	if err != nil {
		t.Fatalf("os.Pipe() error = %v", err)
	}
	os.Stdout = writeFile

	root := clipkg.NewRootCmd()
	root.SetOut(io.Discard)
	root.SetErr(io.Discard)
	root.SetArgs(args)
	commandError := root.Execute()

	writeFile.Close()
	os.Stdout = originalStdout
	os.Stdin = reader
	output, readErr := io.ReadAll(readFile)
	if readErr != nil {
		t.Fatalf("io.ReadAll() error = %v", readErr)
	}
	return string(output), commandError
}

func tempConfig(t *testing.T, value config.Config) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "config.json")
	if err := config.Save(path, value); err != nil {
		t.Fatalf("config.Save() error = %v", err)
	}
	return path
}

func TestAuthLoginValidatesAndSavesToken(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("Authorization"); got != "Bearer cli-token" {
			t.Errorf("Authorization = %q", got)
		}
		_, _ = writer.Write([]byte(`{"user":{"id":1,"username":"ada","email":"ada@example.com"}}`))
	}))
	defer server.Close()

	path := filepath.Join(t.TempDir(), "config.json")
	tokenFile, err := os.CreateTemp(t.TempDir(), "stdin")
	if err != nil {
		t.Fatalf("CreateTemp() error = %v", err)
	}
	defer tokenFile.Close()
	defer os.Remove(tokenFile.Name())
	if _, err := tokenFile.WriteString("cli-token\n"); err != nil {
		t.Fatalf("WriteString() error = %v", err)
	}
	if _, err := tokenFile.Seek(0, 0); err != nil {
		t.Fatalf("Seek() error = %v", err)
	}

	output, err := runCommand(
		t,
		// --server 已提供服务地址，stdin 只用于输入 Token。
		tokenFile,
		"--config", path,
		"--server", server.URL,
		"auth", "login",
	)
	if err != nil {
		t.Fatalf("auth login error = %v, output = %q", err, output)
	}

	loaded, err := config.Load(path)
	if err != nil {
		t.Fatalf("config.Load() error = %v", err)
	}
	if loaded.Server != server.URL || loaded.Token != "cli-token" {
		t.Fatalf("config = %+v", loaded)
	}
	if !strings.Contains(output, "已登录：ada") {
		t.Fatalf("output = %q", output)
	}
}

func TestAuthLoginNonInteractiveWithServerAndToken(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("Authorization"); got != "Bearer cli-token" {
			t.Errorf("Authorization = %q", got)
		}
		_, _ = writer.Write([]byte(`{"user":{"id":1,"username":"ada","email":"ada@example.com"}}`))
	}))
	defer server.Close()

	path := filepath.Join(t.TempDir(), "config.json")
	// stdin 为空文件：一旦实现仍尝试提示输入，登录会失败。
	emptyStdin, err := os.CreateTemp(t.TempDir(), "stdin")
	if err != nil {
		t.Fatalf("CreateTemp() error = %v", err)
	}
	defer emptyStdin.Close()
	defer os.Remove(emptyStdin.Name())

	output, err := runCommand(
		t,
		emptyStdin,
		"--config", path,
		"--server", server.URL,
		"auth", "login",
	)
	if err != nil {
		t.Fatalf("auth login error = %v, output = %q", err, output)
	}

	loaded, err := config.Load(path)
	if err != nil {
		t.Fatalf("config.Load() error = %v", err)
	}
	if loaded.Server != server.URL || loaded.Token != "cli-token" {
		t.Fatalf("config = %+v", loaded)
	}
	if !strings.Contains(output, "已登录：ada") {
		t.Fatalf("output = %q", output)
	}
}

func TestContextUseSetsDefaultProjectAndActiveSprint(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/projects/10" {
			http.NotFound(writer, request)
			return
		}
		_, _ = writer.Write([]byte(`{
			"project":{"id":10,"name":"PongCode"},
			"active_sprint":{"id":20,"name":"Sprint 20"},
			"sprints":[{"id":20,"name":"Sprint 20"}]
		}`))
	}))
	defer server.Close()

	path := tempConfig(t, config.Config{})
	output, err := runCommand(
		t,
		nil,
		"--config", path,
		"--server", server.URL,
		"context", "use", "--project-id", "10",
	)
	if err != nil {
		t.Fatalf("context use error = %v, output = %q", err, output)
	}

	loaded, err := config.Load(path)
	if err != nil {
		t.Fatalf("config.Load() error = %v", err)
	}
	if loaded.ProjectID != 10 || loaded.SprintID != 20 {
		t.Fatalf("config = %+v", loaded)
	}
}

func TestContextUseInteractiveSelectionSavesIDs(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/api/organizations":
			_, _ = writer.Write([]byte(`[{"id":10,"name":"Org"}]`))
		case "/api/organizations/10":
			_, _ = writer.Write([]byte(`{
				"organization":{"id":10,"name":"Org"},
				"projects":[{"id":10,"name":"PongCode","organization_id":10,"team_name":"Core"}]
			}`))
		case "/api/projects/10":
			_, _ = writer.Write([]byte(`{
				"project":{"id":10,"name":"PongCode"},
				"sprints":[{"id":20,"name":"Sprint 20","status_label":"进行中","start_date":"2026-09-01","end_date":"2026-09-15"}]
			}`))
		default:
			t.Errorf("unexpected request %s %s", request.Method, request.URL.Path)
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	path := tempConfig(t, config.Config{})
	stdin, err := os.CreateTemp(t.TempDir(), "stdin")
	if err != nil {
		t.Fatalf("CreateTemp() error = %v", err)
	}
	defer stdin.Close()
	if _, err := stdin.WriteString("1\n1\n1\n"); err != nil {
		t.Fatalf("WriteString() error = %v", err)
	}
	if _, err := stdin.Seek(0, 0); err != nil {
		t.Fatalf("Seek() error = %v", err)
	}

	output, err := runCommand(
		t,
		stdin,
		"--config", path,
		"--server", server.URL,
		"context", "use",
	)
	if err != nil {
		t.Fatalf("context use error = %v, output = %q", err, output)
	}

	loaded, err := config.Load(path)
	if err != nil {
		t.Fatalf("config.Load() error = %v", err)
	}
	if loaded.ProjectID != 10 || loaded.SprintID != 20 {
		t.Fatalf("config = %+v, want project 10 sprint 20", loaded)
	}
	if !strings.Contains(output, "PongCode（ID 10") ||
		!strings.Contains(output, "Sprint 20（ID 20") {
		t.Fatalf("output = %q", output)
	}
}

func TestTaskListUsesBearerTokenAndContext(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("Authorization"); got != "Bearer cli-token" {
			t.Errorf("Authorization = %q", got)
		}
		if request.URL.Path != "/api/projects/10/board" || request.URL.Query().Get("sprint_id") != "20" {
			t.Errorf("request = %s?%s", request.URL.Path, request.URL.RawQuery)
			http.NotFound(writer, request)
			return
		}
		_, _ = writer.Write([]byte(`{
			"has_sprint":true,
			"project":{"id":10,"name":"PongCode"},
			"sprint":{"id":20,"name":"Sprint 20"},
			"swimlanes":[{
				"requirement":{"id":30,"title":"CLI"},
				"todo":[{"id":40,"item_code":"CLI-001","title":"Write CLI","status":"todo","priority":3,"item_type":"task"}],
				"doing":[],
				"done":[{"id":41,"item_code":"BUG-001","title":"Closed bug","status":"closed","priority":"normal","item_type":"bug"}]
			}]
		}`))
	}))
	defer server.Close()

	path := tempConfig(t, config.Config{ProjectID: 10, SprintID: 20})
	output, err := runCommand(
		t,
		nil,
		"--config", path,
		"--server", server.URL,
		"task", "list",
	)
	if err != nil {
		t.Fatalf("task list error = %v, output = %q", err, output)
	}
	if !strings.Contains(output, "CLI-001") || !strings.Contains(output, "Write CLI") {
		t.Fatalf("output = %q", output)
	}
	if strings.Contains(output, "BUG-001") || strings.Contains(output, "Closed bug") {
		t.Fatalf("output includes bug = %q", output)
	}
}

func TestTaskCreateUsesActiveSprintAndSendsPayload(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	var createdBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == "GET" && request.URL.Path == "/api/projects/10":
			_, _ = writer.Write([]byte(`{
				"project":{"id":10,"name":"PongCode"},
				"active_sprint":{"id":20,"name":"Sprint 20"},
				"sprints":[{"id":20,"name":"Sprint 20"}]
			}`))
		case request.Method == "POST" && request.URL.Path == "/api/projects/10/issues":
			if err := json.NewDecoder(request.Body).Decode(&createdBody); err != nil {
				t.Errorf("decode request = %v", err)
			}
			_, _ = writer.Write([]byte(`{"id":40,"item_code":"CLI-001","title":"Write CLI","status":"todo"}`))
		default:
			t.Errorf("unexpected request %s %s", request.Method, request.URL.Path)
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	path := tempConfig(t, config.Config{ProjectID: 10})
	output, err := runCommand(
		t,
		nil,
		"--config", path,
		"--server", server.URL,
		"task", "create", "--title", "Write CLI", "--priority", "2",
	)
	if err != nil {
		t.Fatalf("task create error = %v, output = %q", err, output)
	}
	if createdBody["sprint_id"] != float64(20) || createdBody["title"] != "Write CLI" || createdBody["priority"] != float64(2) {
		t.Fatalf("created body = %#v", createdBody)
	}
	if !strings.Contains(output, "已创建任务 CLI-001") {
		t.Fatalf("output = %q", output)
	}
}

func TestRequirementListShowsIDs(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/projects/10/requirements" ||
			request.URL.Query().Get("search") != "login" ||
			request.URL.Query().Get("status") != "pending" {
			t.Errorf("unexpected request %s?%s", request.URL.Path, request.URL.RawQuery)
			http.NotFound(writer, request)
			return
		}
		_, _ = writer.Write([]byte(`[
			{"id":30,"title":"Login requirement","status":"pending","priority":2,"sprint_id":20,"sprint_name":"Sprint 20"}
		]`))
	}))
	defer server.Close()

	path := tempConfig(t, config.Config{ProjectID: 10})
	output, err := runCommand(
		t,
		nil,
		"--config", path,
		"--server", server.URL,
		"requirement", "list", "--search", "login", "--status", "pending",
	)
	if err != nil {
		t.Fatalf("requirement list error = %v, output = %q", err, output)
	}
	if !strings.Contains(output, "30") || !strings.Contains(output, "Login requirement") {
		t.Fatalf("output = %q", output)
	}
}

func TestRequirementCreateSendsPayloadAndShowsID(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	var createdBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != "POST" || request.URL.Path != "/api/projects/10/requirements" {
			t.Errorf("unexpected request %s %s", request.Method, request.URL.Path)
			http.NotFound(writer, request)
			return
		}
		if err := json.NewDecoder(request.Body).Decode(&createdBody); err != nil {
			t.Errorf("decode request = %v", err)
		}
		_, _ = writer.Write([]byte(`{"id":30,"title":"Login requirement"}`))
	}))
	defer server.Close()

	path := tempConfig(t, config.Config{})
	output, err := runCommand(
		t,
		nil,
		"--config", path,
		"--server", server.URL,
		"requirement", "create",
		"--project-id", "10",
		"--sprint-id", "20",
		"--title", "Login requirement",
		"--content", "Cover login flow",
		"--priority", "2",
	)
	if err != nil {
		t.Fatalf("requirement create error = %v, output = %q", err, output)
	}

	want := map[string]any{
		"title":     "Login requirement",
		"content":   "Cover login flow",
		"priority":  float64(2),
		"status":    "pending",
		"sprint_id": float64(20),
	}
	for key, value := range want {
		if createdBody[key] != value {
			t.Fatalf("created body[%q] = %#v, want %#v; body=%#v", key, createdBody[key], value, createdBody)
		}
	}
	if !strings.Contains(output, "已创建需求 Login requirement（ID 30）") {
		t.Fatalf("output = %q", output)
	}
}

func TestRequirementUpdateSendsPayload(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	var updatedBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != "PUT" || request.URL.Path != "/api/requirements/30" {
			t.Errorf("unexpected request %s %s", request.Method, request.URL.Path)
			http.NotFound(writer, request)
			return
		}
		if err := json.NewDecoder(request.Body).Decode(&updatedBody); err != nil {
			t.Errorf("decode request = %v", err)
		}
		_, _ = writer.Write([]byte(`{
			"id":30,
			"title":"Login requirement v2",
			"status":"in_progress",
			"priority":1,
			"sprint_id":21,
			"sprint_name":"Sprint 21"
		}`))
	}))
	defer server.Close()

	path := tempConfig(t, config.Config{})
	output, err := runCommand(
		t,
		nil,
		"--config", path,
		"--server", server.URL,
		"requirement", "update", "30",
		"--title", "Login requirement v2",
		"--status", "in_progress",
		"--priority", "1",
		"--sprint-id", "21",
		"--expected-delivery-date", "2026-11-15",
	)
	if err != nil {
		t.Fatalf("requirement update error = %v, output = %q", err, output)
	}

	want := map[string]any{
		"title":                  "Login requirement v2",
		"status":                 "in_progress",
		"priority":               float64(1),
		"sprint_id":              float64(21),
		"expected_delivery_date": "2026-11-15",
	}
	for key, value := range want {
		if updatedBody[key] != value {
			t.Fatalf("updated body[%q] = %#v, want %#v; body = %#v", key, updatedBody[key], value, updatedBody)
		}
	}
	if !strings.Contains(output, "已更新需求 Login requirement v2（ID 30）") {
		t.Fatalf("output = %q", output)
	}
}

func TestRequirementUpdateClearFlagsSendNull(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	var updatedBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != "PUT" || request.URL.Path != "/api/requirements/30" {
			t.Errorf("unexpected request %s %s", request.Method, request.URL.Path)
			http.NotFound(writer, request)
			return
		}
		if err := json.NewDecoder(request.Body).Decode(&updatedBody); err != nil {
			t.Errorf("decode request = %v", err)
		}
		_, _ = writer.Write([]byte(`{"id":30,"title":"Login requirement"}`))
	}))
	defer server.Close()

	path := tempConfig(t, config.Config{})
	output, err := runCommand(
		t,
		nil,
		"--config", path,
		"--server", server.URL,
		"requirement", "update", "30", "--clear-sprint", "--clear-delivery-date",
	)
	if err != nil {
		t.Fatalf("requirement update error = %v, output = %q", err, output)
	}

	if value, ok := updatedBody["sprint_id"]; !ok || value != nil {
		t.Fatalf("updated body[sprint_id] = %#v, want explicit null; body = %#v", updatedBody["sprint_id"], updatedBody)
	}
	if value, ok := updatedBody["expected_delivery_date"]; !ok || value != nil {
		t.Fatalf("updated body[expected_delivery_date] = %#v, want explicit null; body = %#v", updatedBody["expected_delivery_date"], updatedBody)
	}
}

func TestRequirementUpdateRejectsInvalidDate(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		t.Errorf("unexpected request %s %s", request.Method, request.URL.Path)
		http.NotFound(writer, request)
	}))
	defer server.Close()

	path := tempConfig(t, config.Config{})
	output, err := runCommand(
		t,
		nil,
		"--config", path,
		"--server", server.URL,
		"requirement", "update", "30", "--expected-delivery-date", "2026/11/15",
	)
	if err == nil || !strings.Contains(err.Error(), "YYYY-MM-DD") {
		t.Fatalf("error = %v, output = %q", err, output)
	}
}

func TestRequirementDeleteReportsCascadedTasks(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != "DELETE" || request.URL.Path != "/api/requirements/30" {
			t.Errorf("unexpected request %s %s", request.Method, request.URL.Path)
			http.NotFound(writer, request)
			return
		}
		_, _ = writer.Write([]byte(`{"success":true,"deleted_count":1,"deleted_issue_count":3}`))
	}))
	defer server.Close()

	path := tempConfig(t, config.Config{})
	output, err := runCommand(
		t,
		nil,
		"--config", path,
		"--server", server.URL,
		"requirement", "delete", "30", "--yes",
	)
	if err != nil {
		t.Fatalf("requirement delete error = %v, output = %q", err, output)
	}
	if !strings.Contains(output, "需求 30 已删除，连带删除 3 个任务") {
		t.Fatalf("output = %q", output)
	}
}

func TestRequirementDeleteCancelsWithoutConfirmation(t *testing.T) {
	t.Setenv("PONGCODE_TOKEN", "cli-token")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		t.Errorf("unexpected request %s %s", request.Method, request.URL.Path)
		http.NotFound(writer, request)
	}))
	defer server.Close()

	stdin, err := os.CreateTemp(t.TempDir(), "stdin")
	if err != nil {
		t.Fatalf("CreateTemp() error = %v", err)
	}
	defer stdin.Close()
	if _, err := stdin.WriteString("n\n"); err != nil {
		t.Fatalf("WriteString() error = %v", err)
	}
	if _, err := stdin.Seek(0, 0); err != nil {
		t.Fatalf("Seek() error = %v", err)
	}

	path := tempConfig(t, config.Config{})
	output, err := runCommand(
		t,
		stdin,
		"--config", path,
		"--server", server.URL,
		"requirement", "delete", "30",
	)
	if err != nil {
		t.Fatalf("requirement delete error = %v, output = %q", err, output)
	}
	if !strings.Contains(output, "已取消删除") {
		t.Fatalf("output = %q", output)
	}
}
