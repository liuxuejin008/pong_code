(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};

        MiniAgile.views.viewLogin = function() {
            this.setMain(`
                <div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
                  <div class="sm:mx-auto sm:w-full sm:max-w-md bg-white p-10 rounded-xl shadow-xl border border-gray-100">
                    <div class="text-center mb-8">
                        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-600 text-white mb-4 shadow-lg shadow-purple-500/30">
                            <i class="fa-solid fa-bolt text-xl"></i>
                        </div>
                        <h2 class="text-2xl font-bold leading-9 tracking-tight text-gray-900">登录 Mini-Agile</h2>
                        <p class="mt-2 text-sm text-gray-500">专注管理您的项目</p>
                    </div>

                    <form class="space-y-6" onsubmit="app.handlers.login(event)">
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">用户名</label>
                        <input name="username" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <div class="flex items-center justify-between mb-2">
                          <label class="block text-sm font-medium leading-6 text-gray-900">密码</label>
                          <button type="button" onclick="app.navigate('forgot_password')" class="text-xs font-medium text-purple-600 hover:text-purple-500 transition-colors">忘记密码？</button>
                        </div>
                        <input name="password" type="password" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <button type="submit" class="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 transition-all transform active:scale-95">
                          <i class="fa-solid fa-right-to-bracket"></i>
                          确定登录
                        </button>
                      </div>
                    </form>
                    <div class="mt-6 border-t border-gray-100 pt-4 text-center">
                      <button type="button" data-testid="go-register-button" onclick="app.navigate('register')" class="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all">
                        还没有账号？去注册
                      </button>
                    </div>
                  </div>
                </div>
            `);
            this.renderNav();
        };

        MiniAgile.views.viewRegister = function() {
            this.setMain(`
               <div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
                  <div class="sm:mx-auto sm:w-full sm:max-w-md bg-white p-10 rounded-xl shadow-xl border border-gray-100">
                    <div class="text-center mb-8">
                        <h2 class="text-2xl font-bold leading-9 tracking-tight text-gray-900">创建您的账号</h2>
                        <p class="mt-2 text-sm text-gray-500">立即加入 Mini-Agile</p>
                    </div>

                    <form class="space-y-5" onsubmit="app.handlers.register(event)">
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">用户名</label>
                        <input name="username" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">电子邮箱</label>
                        <input name="email" type="email" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">密码</label>
                        <input name="password" type="password" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <button type="submit" class="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 transition-all transform active:scale-95">
                          <i class="fa-solid fa-check"></i>
                          确定注册
                        </button>
                      </div>
                    </form>
                    <div class="mt-6 border-t border-gray-100 pt-4 text-center">
                      <button type="button" data-testid="go-login-button" onclick="app.navigate('login')" class="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all">
                        已有账号，去登录
                      </button>
                    </div>
                  </div>
                </div>
            `);
            this.renderNav();
        };

        MiniAgile.views.viewForgotPassword = function() {
            this.setMain(`
                <div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
                  <div class="sm:mx-auto sm:w-full sm:max-w-md bg-white p-10 rounded-xl shadow-xl border border-gray-100">
                    <div class="text-center mb-8">
                        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-600 text-white mb-4 shadow-lg shadow-purple-500/30">
                            <i class="fa-solid fa-envelope text-xl"></i>
                        </div>
                        <h2 class="text-2xl font-bold leading-9 tracking-tight text-gray-900">重置密码</h2>
                        <p class="mt-2 text-sm text-gray-500">输入注册邮箱，我们将向您发送重置链接</p>
                    </div>

                    <form class="space-y-6" onsubmit="app.handlers.forgotPassword(event)">
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">电子邮箱</label>
                        <input name="email" type="email" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <button type="submit" class="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 transition-all transform active:scale-95">
                          <i class="fa-solid fa-paper-plane"></i>
                          发送重置链接
                        </button>
                      </div>
                    </form>
                    <div class="mt-6 border-t border-gray-100 pt-4 text-center">
                      <button type="button" onclick="app.navigate('login')" class="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all">
                        <i class="fa-solid fa-arrow-left mr-2"></i>返回登录
                      </button>
                    </div>
                  </div>
                </div>
            `);
            this.renderNav();
        };

        MiniAgile.views.viewResetPassword = function() {
            if (!this.resetToken) {
                this.navigate('login');
                return;
            }
            this.setMain(`
                <div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
                  <div class="sm:mx-auto sm:w-full sm:max-w-md bg-white p-10 rounded-xl shadow-xl border border-gray-100">
                    <div class="text-center mb-8">
                        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-600 text-white mb-4 shadow-lg shadow-purple-500/30">
                            <i class="fa-solid fa-key text-xl"></i>
                        </div>
                        <h2 class="text-2xl font-bold leading-9 tracking-tight text-gray-900">设置新密码</h2>
                        <p class="mt-2 text-sm text-gray-500">请输入您的新密码（至少 6 位）</p>
                    </div>

                    <form class="space-y-5" onsubmit="app.handlers.resetPassword(event)">
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">新密码</label>
                        <div class="relative">
                          <input id="reset-password" name="password" type="password" required minlength="6" class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm px-3 pr-10 bg-gray-50 border hover:bg-white transition-colors">
                          <button type="button" onclick="app.toggleResetPasswordVisibility()" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-purple-600 transition-colors" aria-label="显示/隐藏密码">
                            <i data-eye-icon class="fa-solid fa-eye"></i>
                          </button>
                        </div>
                      </div>
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">确认新密码</label>
                        <div class="relative">
                          <input id="reset-password-confirm" name="password_confirm" type="password" required minlength="6" class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm px-3 pr-10 bg-gray-50 border hover:bg-white transition-colors">
                          <button type="button" onclick="app.toggleResetPasswordVisibility()" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-purple-600 transition-colors" aria-label="显示/隐藏密码">
                            <i data-eye-icon class="fa-solid fa-eye"></i>
                          </button>
                        </div>
                      </div>
                      <div>
                        <button type="submit" class="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 transition-all transform active:scale-95">
                          <i class="fa-solid fa-check"></i>
                          确认重置
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
            `);
            this.renderNav();
        };

})();
