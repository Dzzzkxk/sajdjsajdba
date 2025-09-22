(async () => {
    console.clear();
    const noop = () => {};
    console.warn = console.error = window.debug = noop;

    class NotificationSystem {
        constructor() {
            this.initStyles();
            this.notificationContainer = this.createContainer();
            document.body.appendChild(this.notificationContainer);
        }
        initStyles() {
            if (document.getElementById('custom-notification-styles')) return;
            const css = `
                .notification-container { position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; align-items: flex-end; pointer-events: none; }
                .notification { background: rgba(20,20,20,.9); color: #f0f0f0; margin-bottom: 10px; padding: 12px 18px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.3); font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; font-size: 13.5px; width: 280px; min-height: 50px; text-align: center; display: flex; align-items: center; position: relative; overflow: hidden; pointer-events: auto; opacity: 0; transform: translateY(-20px); transition: opacity .3s ease, transform .3s ease; }
                .notification.show { opacity:1; transform: translateY(0); }
                .notification-icon { margin-right: 10px; display: flex; align-items: center; justify-content: center; }
                .notification-progress { position:absolute; bottom:0; left:0; height:3px; width:100%; background:#f0f0f0; opacity:.8; }
                @keyframes progress-animation { from { width: 100%; } to { width: 0%; } }
                .notification-progress.animate { animation: progress-animation linear forwards; }
                .notification.success .notification-icon { color:#4caf50; }
                .notification.error .notification-icon { color:#f44336; }
                .notification.info .notification-icon { color:#2196f3; }
                .notification.warning .notification-icon { color:#ff9800; }
            `;
            const style = document.createElement('style');
            style.id = 'custom-notification-styles';
            style.textContent = css;
            document.head.appendChild(style);
        }
        createContainer() { const container = document.createElement('div'); container.className = 'notification-container'; return container; }
        createIcon(type) {
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'notification-icon';
            const icons = {
                success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
                error: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
                warning: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
                info: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
            };
            iconWrapper.innerHTML = icons[type] || icons.info;
            return iconWrapper;
        }
        show(message, options={}) {
            const { duration=5000, type='info' } = options;
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.appendChild(this.createIcon(type));
            const textSpan = document.createElement('span'); textSpan.textContent = message; notification.appendChild(textSpan);
            const progressBar = document.createElement('div'); progressBar.className='notification-progress'; notification.appendChild(progressBar);
            this.notificationContainer.appendChild(notification);
            notification.offsetHeight; notification.classList.add('show');
            progressBar.classList.add('animate'); progressBar.style.animationDuration = `${duration}ms`;
            setTimeout(() => { notification.classList.remove('show'); setTimeout(()=>{ if(notification.parentNode) this.notificationContainer.removeChild(notification); },300); }, duration);
            return notification;
        }
        success(msg,d=5000){return this.show(msg,{type:'success',duration:d});}
        error(msg,d=5000){return this.show(msg,{type:'error',duration:d});}
        info(msg,d=5000){return this.show(msg,{type:'info',duration:d});}
        warning(msg,d=5000){return this.show(msg,{type:'warning',duration:d});}
    }

    let capturedLoginData = null;
    const originalFetch = window.fetch;
    const notifications = new NotificationSystem();

    // Aviso caso token não seja capturado
    function checkToken() {
        if(!capturedLoginData) notifications.error("Token não capturado! Certifique-se de logar depois de rodar o script.", 6000);
    }

    // Sobrescreve fetch com proteção e correção
    window.fetch = async function(input, init) {
        const url = typeof input==='string'?input:input.url;

        // Captura token no login
        if(url.includes('/registration/edusp/token') && !capturedLoginData){
            try{
                const response = await originalFetch.apply(this, arguments);
                const cloned = response.clone();
                const data = await cloned.json();
                if(data?.auth_token){
                    capturedLoginData = data;
                    notifications.success("Login capturado!",3500);
                } else { checkToken(); }
                return response;
            }catch(e){ checkToken(); return originalFetch.apply(this, arguments); }
        }

        const response = await originalFetch.apply(this, arguments);

        // Detecta envio de tarefa e corrige
        if(/\/tms\/task\/\d+\/answer/.test(url) && init?.method==='POST'){
            if(!capturedLoginData?.auth_token) { checkToken(); return response; }

            const clonedResponse = response.clone();
            clonedResponse.json().then(async submittedData=>{
                if(submittedData?.status!=='draft' && submittedData?.id && submittedData?.task_id){
                    notifications.info("Envio detectado! Iniciando correção...",4000);
                    const headers = {
                        "x-api-realm":"edusp",
                        "x-api-platform":"webclient",
                        "x-api-key":capturedLoginData.auth_token,
                        "content-type":"application/json"
                    };
                    try{
                        const respostas = await fetch(`https://edusp-api.ip.tv/tms/task/${submittedData.task_id}/answer/${submittedData.id}?with_task=true&with_genre=true&with_questions=true&with_assessed_skills=true`, { headers }).then(r=>r.json());
                        const payload = transformJson(respostas);
                        await fetch(`https://edusp-api.ip.tv/tms/task/${submittedData.task_id}/answer/${submittedData.id}`, { method:'PUT', headers, body: JSON.stringify(payload) });
                        notifications.success("Tarefa corrigida com sucesso!",5000);
                    }catch(e){ notifications.error("Erro na correção automática.",5000); }
                }
            }).catch(()=>{});
        }
        return response;
    };

})();
