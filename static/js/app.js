const { createApp, nextTick } = Vue;

window.MiniAgile = window.MiniAgile || {};
window.MiniAgile.nextTick = nextTick;

function mergeMethods(target, source) {
    Object.keys(source || {}).forEach((key) => {
        if (!target[key]) {
            target[key] = source[key];
        }
    });
}

const appConfig = {
    data() {
        return window.MiniAgile.core.data.call(this);
    },
    computed: window.MiniAgile.core.computed || {},
    methods: {},
    mounted() {
        window.MiniAgile.core.mounted.call(this);
    }
};

mergeMethods(appConfig.methods, window.MiniAgile.core.methods);
mergeMethods(appConfig.methods, window.MiniAgile.views);
mergeMethods(appConfig.methods, window.MiniAgile.handlers);
mergeMethods(appConfig.methods, window.MiniAgile.modals);

createApp(appConfig).mount('#app');
