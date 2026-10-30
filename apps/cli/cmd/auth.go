package cmd

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/liuxuejin008/pong_code/apps/cli/internal/api"
	"github.com/spf13/cobra"
)

func addAuthCommands(root *cobra.Command) {
	auth := &cobra.Command{Use: "auth", Short: "管理 CLI 授权"}
	auth.AddCommand(&cobra.Command{
		Use:   "login",
		Short: "登录并保存 CLI Token",
		Long:  "登录并保存 CLI Token。服务地址由 --server 或 PONGCODE_SERVER、Token 由 PONGCODE_TOKEN 提供时直接使用；缺失的信息才会提示输入，全部提供时无需交互。",
		RunE: func(cmd *cobra.Command, args []string) error {
			loaded, path, err := loadConfigFile(cmd)
			if err != nil {
				return err
			}

			flagServer, err := cmd.Flags().GetString("server")
			if err != nil {
				return err
			}
			server := strings.TrimSpace(flagServer)
			if server == "" {
				server = strings.TrimSpace(os.Getenv("PONGCODE_SERVER"))
			}

			input := bufio.NewReader(os.Stdin)
			if server == "" {
				defaultServer := strings.TrimSpace(loaded.Server)
				if defaultServer == "" {
					defaultServer = "http://localhost:5001"
				}
				fmt.Printf("服务地址 [%s]: ", defaultServer)
				server, err = readLine(input, "")
				if err != nil {
					return err
				}
				if server == "" {
					server = defaultServer
				}
			}

			token := strings.TrimSpace(os.Getenv("PONGCODE_TOKEN"))
			if token == "" {
				if stdinIsTerminal() {
					token, err = readSecret("请输入 CLI Token: ")
				} else {
					token, err = readLine(input, "请输入 CLI Token: ")
				}
				if err != nil {
					return err
				}
			}
			if token == "" {
				return errors.New("CLI Token 不能为空")
			}

			client := api.NewClient(server, token)
			var profile api.Profile
			if err := client.Do("GET", "/auth/profile", nil, &profile); err != nil {
				return err
			}

			loaded.Server = server
			loaded.Token = token
			if err := saveConfig(path, *loaded); err != nil {
				return err
			}
			fmt.Printf("已登录：%s <%s>\n", profile.User.Username, profile.User.Email)
			return nil
		},
	})
	auth.AddCommand(&cobra.Command{
		Use:   "status",
		Short: "查看当前 CLI 授权",
		RunE: func(cmd *cobra.Command, args []string) error {
			runtime, err := newRuntime(cmd, true)
			if err != nil {
				return err
			}
			var profile api.Profile
			if err := runtime.client.Do("GET", "/auth/profile", nil, &profile); err != nil {
				return err
			}
			fmt.Printf("服务地址：%s（%s）\n", runtime.server, runtime.serverSource)
			fmt.Printf("当前用户：%s <%s>\n", profile.User.Username, profile.User.Email)
			fmt.Printf("Token 来源：%s\n", runtime.tokenSource)
			return nil
		},
	})
	auth.AddCommand(&cobra.Command{
		Use:   "logout",
		Short: "清除本地保存的 CLI Token",
		RunE: func(cmd *cobra.Command, args []string) error {
			loaded, path, err := loadConfigFile(cmd)
			if err != nil {
				return err
			}
			loaded.Token = ""
			if err := saveConfig(path, *loaded); err != nil {
				return err
			}
			fmt.Println("已清除本地 CLI Token")
			return nil
		},
	})
	root.AddCommand(auth)
}
