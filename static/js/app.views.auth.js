(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.views = MiniAgile.views || {};

        MiniAgile.views.viewLogin = function() {
            this.setMain(`
                <div class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-gray-50">
                  <div class="sm:mx-auto sm:w-full sm:max-w-md bg-white p-10 rounded-xl shadow-xl border border-gray-100">
                    <div class="text-center mb-8">
                        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-600 text-white mb-4 shadow-lg shadow-primary-500/30">
                            <i class="fa-solid fa-bolt text-xl"></i>
                        </div>
                        <h2 class="text-2xl font-bold leading-9 tracking-tight text-gray-900">登录 Mini-Agile</h2>
                        <p class="mt-2 text-sm text-gray-500">专注管理您的项目</p>
                    </div>

                    <form class="space-y-6" onsubmit="app.handlers.login(event)">
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">用户名</label>
                        <input name="username" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <div class="flex items-center justify-between mb-2">
                          <label class="block text-sm font-medium leading-6 text-gray-900">密码</label>
                        </div>
                        <input name="password" type="password" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <button type="submit" class="flex w-full justify-center rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-all transform active:scale-95">登录</button>
                      </div>
                    </form>
                    <p class="mt-8 text-center text-sm text-gray-500">
                      还没有账号？
                      <a href="#" onclick="app.navigate('register')" class="font-semibold leading-6 text-primary-600 hover:text-primary-500 hover:underline">免费注册</a>
                    </p>
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
                        <input name="username" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">电子邮箱</label>
                        <input name="email" type="email" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <label class="block text-sm font-medium leading-6 text-gray-900 mb-2">密码</label>
                        <input name="password" type="password" required class="block w-full rounded-lg border-gray-300 py-2.5 text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 bg-gray-50 border hover:bg-white transition-colors">
                      </div>
                      <div>
                        <button type="submit" class="flex w-full justify-center rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-all transform active:scale-95">注册</button>
                      </div>
                    </form>
                    <p class="mt-8 text-center text-sm text-gray-500">
                      已有账号？
                      <a href="#" onclick="app.navigate('login')" class="font-semibold leading-6 text-primary-600 hover:text-primary-500 hover:underline">立即登录</a>
                    </p>
                  </div>
                </div>
            `);
            this.renderNav();
        };

})();
