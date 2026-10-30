package api

import "encoding/json"

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type Profile struct {
	User User `json:"user"`
}

type Organization struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Team struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Project struct {
	ID               int64  `json:"id"`
	Name             string `json:"name"`
	OrganizationID   int64  `json:"organization_id"`
	TeamID           int64  `json:"team_id"`
	TeamName         string `json:"team_name"`
	OrganizationName string `json:"-"`
}

type OrganizationDetail struct {
	Organization Organization `json:"organization"`
	Projects     []Project    `json:"projects"`
	Teams        []Team       `json:"teams"`
}

type Sprint struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Status      string `json:"status"`
	StatusLabel string `json:"status_label"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
}

type ProjectDetail struct {
	Project      Project      `json:"project"`
	Organization Organization `json:"organization"`
	ActiveSprint *Sprint      `json:"active_sprint"`
	Sprints      []Sprint     `json:"sprints"`
}

type Requirement struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	Content    string `json:"content"`
	Status     string `json:"status"`
	Priority   int    `json:"priority"`
	SprintID   int64  `json:"sprint_id"`
	SprintName string `json:"sprint_name"`
}

type RequirementDeleteResult struct {
	Success           bool `json:"success"`
	DeletedCount      int  `json:"deleted_count"`
	DeletedIssueCount int  `json:"deleted_issue_count"`
}

type Issue struct {
	ID               int64   `json:"id"`
	ItemCode         string  `json:"item_code"`
	Title            string  `json:"title"`
	Description      string  `json:"description"`
	Status           string  `json:"status"`
	Priority         int     `json:"priority"`
	TimeEstimate     float64 `json:"time_estimate"`
	TimeSpent        float64 `json:"time_spent"`
	AssigneeID       int64   `json:"assignee_id"`
	AssigneeName     string  `json:"assignee_name"`
	ProjectID        int64   `json:"project_id"`
	SprintID         int64   `json:"sprint_id"`
	RequirementID    int64   `json:"requirement_id"`
	RequirementTitle string  `json:"requirement_title"`
	ItemType         string  `json:"item_type"`
}

type BoardItem struct {
	Issue
	BoardStatus string `json:"board_status"`
}

func (item *BoardItem) UnmarshalJSON(data []byte) error {
	var metadata struct {
		ItemType string `json:"item_type"`
	}
	if err := json.Unmarshal(data, &metadata); err != nil {
		return err
	}

	type rawBoardItem BoardItem
	if metadata.ItemType == "bug" {
		var bugItem struct {
			rawBoardItem
			Priority json.RawMessage `json:"priority"`
		}
		if err := json.Unmarshal(data, &bugItem); err != nil {
			return err
		}
		*item = BoardItem(bugItem.rawBoardItem)
		return nil
	}

	var taskItem rawBoardItem
	if err := json.Unmarshal(data, &taskItem); err != nil {
		return err
	}
	*item = BoardItem(taskItem)
	return nil
}

type Swimlane struct {
	Requirement *Requirement `json:"requirement"`
	Todo        []BoardItem  `json:"todo"`
	Doing       []BoardItem  `json:"doing"`
	Done        []BoardItem  `json:"done"`
}

type Board struct {
	HasSprint    bool         `json:"has_sprint"`
	Project      Project      `json:"project"`
	Organization Organization `json:"organization"`
	Sprint       Sprint       `json:"sprint"`
	Swimlanes    []Swimlane   `json:"swimlanes"`
}

type IssueDetail struct {
	Issue Issue `json:"issue"`
}

type Success struct {
	Success bool `json:"success"`
}
