(function () {
    const MiniAgile = window.MiniAgile = window.MiniAgile || {};
    MiniAgile.modals = MiniAgile.modals || {};

        MiniAgile.modals.modalShow = function(html) {
            this.modalHtml = `
                <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
                     <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                            <i class="fa-solid fa-bolt text-white text-sm"></i>
                        </div>
                        <h3 class="text-lg font-bold text-gray-900">Mini-Agile</h3>
                     </div>
                     <button type="button" onclick="app.modals.close()" class="text-gray-400 hover:text-gray-600 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all cursor-pointer">
                        <i class="fa-solid fa-times"></i>
                     </button>
                </div>
                <div class="p-6">
                    ${html}
                </div>
            `;
            this.showModal = true;
        };

        MiniAgile.modals.modalClose = function() {
            this.showModal = false;
        };

})();
