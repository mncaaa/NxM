// Shared JS for NxM (password gate, hearts animation, per-page music, slideshow, gallery, messages)

// ------------- Utilities -------------
const STORAGE_PREFIX = 'nxm_'; // keys: nxm_home_audio, nxm_messages_audio, nxm_memories_audio, nxm_about_audio, nxm_messages_list, nxm_gallery
function save(key, value){ localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); }
function load(key, fallback){ const v = localStorage.getItem(STORAGE_PREFIX + key); return v ? JSON.parse(v) : fallback; }
function escapeHtml(s){ return (s||'').toString().replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }

// ------------- HEARTS ANIMATION (runs on every page) -------------
(function heartsModule(){
  const canvas = document.getElementById('heartsCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = window.innerWidth, H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  window.addEventListener('resize', ()=>{ W=window.innerWidth; H=window.innerHeight; canvas.width=W; canvas.height=H; });

  const hearts = [];
  function rand(min,max){ return Math.random()*(max-min)+min; }

  function drawHeart(x,y,size,angle,color,alpha=1){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    const s = size/20;
    ctx.moveTo(0, -10*s);
    ctx.bezierCurveTo(10*s, -25*s, 35*s, -10*s, 0, 15*s);
    ctx.bezierCurveTo(-35*s, -10*s, -10*s, -25*s, 0, -10*s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function spawnIdle(){
    hearts.push({
      x: rand(0,W), y: H + rand(20,200),
      vy: -rand(0.15,0.6), vx: rand(-0.15,0.15),
      size: rand(8,22), angle: rand(-0.3,0.3), spin: rand(-0.002,0.002),
      type:'idle', color: ['#ff7ab6','#ffb3d6','#ffc7df'][Math.floor(rand(0,3))], life: Infinity
    });
  }
  function spawnBurst(cx,cy,count=36){
    for(let i=0;i<count;i++){
      const speed = rand(1.5,4.5);
      const ang = rand(-Math.PI, 0);
      hearts.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * speed * rand(0.4,1.2),
        vy: Math.sin(ang) * speed * rand(0.6,1.2),
        size: rand(10,28), angle: rand(-1,1), spin: rand(-0.08,0.08),
        life: 120 + Math.floor(rand(0,80)),
        type:'burst', color: ['#ff7ab6','#ffb3d6','#ffc7df','#ffd3e8'][Math.floor(rand(0,4))]
      });
    }
  }

  function animate(){
    ctx.clearRect(0,0,W,H);
    for(let i=hearts.length-1;i>=0;i--){
      const p = hearts[i];
      if(p.type === 'idle'){
        p.x += p.vx; p.y += p.vy; p.angle += p.spin;
        const alpha = Math.max(0, Math.min(1, (H - Math.abs(p.y))/H));
        drawHeart(p.x,p.y,p.size,p.angle,p.color,alpha*0.95);
        if(p.y < -60 || p.x < -100 || p.x > W+100) hearts.splice(i,1);
      } else {
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.995; p.vy *= 0.995; p.angle += p.spin; p.life--;
        const alpha = Math.max(0, p.life/200);
        drawHeart(p.x,p.y,p.size,p.angle,p.color,alpha);
        if(p.life <= 0 || p.y > H + 80) hearts.splice(i,1);
      }
    }
    if(Math.random() < 0.02) spawnIdle();
    requestAnimationFrame(animate);
  }
  // initial seed
  for(let i=0;i<12;i++) spawnIdle();
  animate();

  // expose small API
  window.nxmHeartsBurst = (x=window.innerWidth*0.5, y=window.innerHeight*0.45) => spawnBurst(x,y,36);
})();

// ------------- PASSWORD GATE for index.html -------------
(function passwordGate(){
  const pwInput = document.getElementById('passwordInput');
  const enterBtn = document.getElementById('enterBtn');
  const pwMsg = document.getElementById('pwMsg');
  const gate = document.getElementById('gateContainer');
  const home = document.getElementById('homeContainer');
  if(!pwInput || !enterBtn) return;

  const PASSWORD = 'ilovemikabubu';
  function showMsg(text, color='') { pwMsg.textContent = text; pwMsg.style.color = color; }

  enterBtn.addEventListener('click', ()=> {
    const v = (pwInput.value||'').trim();
    if(v.toLowerCase() === PASSWORD){
      // fade out gate, fade in home
      gate.classList.add('fade-out');
      setTimeout(()=>{ gate.classList.add('d-none'); home.classList.remove('d-none'); home.classList.add('fade-in'); }, 420);
      save('lastUnlocked', Date.now());
      // small hearts burst
      window.nxmHeartsBurst();
    } else {
      showMsg('Try again, love 💔', '#ff9fbf');
      pwInput.value = '';
      pwInput.focus();
    }
  });

  // hint button (gentle)
  const hintBtn = document.getElementById('hintBtn');
  if(hintBtn) hintBtn.addEventListener('click', ()=> { showMsg('Hint: starts with "i" and has "mika" inside ;)', '#ffd3e8'); });
})();

// ------------- HOME: Thumbnails control & local audio override -------------
(function homeSlideshowAndAudio(){
  const carouselEl = document.getElementById('homeCarousel');
  if(!carouselEl) return; // not on this page

  const car = new bootstrap.Carousel(carouselEl, { interval: 4500, ride: 'carousel' });

  // build thumbnails based on slides
  const inner = document.querySelectorAll('#carouselInnerHome .carousel-item img');
  const thumbsDiv = document.getElementById('homeThumbs');
  if(thumbsDiv){
    inner.forEach((img,i)=>{
      const btn = document.createElement('div');
      btn.className = 'thumb-item';
      btn.style.width = '80px';
      btn.style.cursor = 'pointer';
      btn.innerHTML = `<img src="${img.src}" class="img-fluid rounded" style="height:58px;object-fit:cover">`;
      btn.addEventListener('click', ()=> car.to(i));
      thumbsDiv.appendChild(btn);
    });
  }

  // local audio override: if user uploads a local audio, use it instead of spotify iframe
  const musicKey = 'home_audio';
  const localAudio = document.getElementById('localAudioHome');
  const upload = document.getElementById('musicUploadHome');

  // load any saved local audio
  const saved = load(musicKey);
  if(saved){ localAudio.src = saved; localAudio.load(); }

  if(upload){
    upload.addEventListener('change', async (e)=>{
      const f = e.target.files[0]; if(!f) return;
      const data = await fileToDataURL(f);
      localAudio.src = data; localAudio.play().catch(()=>{});
      save(musicKey, data);
    });
  }

  function fileToDataURL(file){
    return new Promise((res,rej)=>{
      const r = new FileReader();
      r.onload = ()=>res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
})();

// ------------- MESSAGES page logic -------------
(function messagesModule(){
  if(!document.getElementById('newMessage')) return;
  const listKey = 'messages_list';
  let messages = load(listKey, []);
  const renderList = () => {
    const container = document.getElementById('messagesList');
    container.innerHTML = '';
    if(!messages || messages.length === 0) {
      container.innerHTML = '<div class="col-12 small-muted">No messages yet — add one above.</div>';
      return;
    }
    messages.slice().reverse().forEach((m, idx)=>{
      const col = document.createElement('div'); col.className = 'col-md-6';
      const html = `<div class="msg-card">
        <div class="d-flex justify-content-between align-items-start">
          <div><strong>${escapeHtml(m.title||'')}</strong></div>
          <div><small class="small-muted">${escapeHtml(m.date||'')}</small></div>
        </div>
        <p class="mb-1">${escapeHtml(m.text)}</p>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-light edit">Edit</button>
          <button class="btn btn-sm btn-danger del">Delete</button>
        </div>
      </div>`;
      col.innerHTML = html;
      // bind edit/delete
      col.querySelector('.del').onclick = ()=>{
        if(confirm('Delete this message?')) { messages.splice(messages.length -1 - idx, 1); save(listKey, messages); renderList(); }
      };
      col.querySelector('.edit').onclick = ()=>{
        const pos = messages.length -1 - idx;
        const newText = prompt('Edit message', messages[pos].text);
        if(newText !== null){ messages[pos].text = newText; save(listKey, messages); renderList(); }
      };
      container.appendChild(col);
    });
  };

  renderList();

  document.getElementById('addMsgBtn').addEventListener('click', ()=>{
    const txt = document.getElementById('newMessage').value.trim();
    const title = document.getElementById('msgTitle').value.trim();
    if(!txt) return alert('Write something first!');
    const entry = { title, text: txt, date: new Date().toLocaleString() };
    messages.push(entry);
    save(listKey, messages);
    document.getElementById('newMessage').value = '';
    document.getElementById('msgTitle').value = '';
    renderList();
  });

  // local music upload (messages page)
  const upload = document.getElementById('musicUploadMessages');
  const audioEl = document.getElementById('localAudioMessages');
  const key = 'messages_audio';
  const saved = load(key);
  if(saved) audioEl.src = saved;
  if(upload){
    upload.addEventListener('change', async (e)=>{
      const f = e.target.files[0]; if(!f) return;
      const data = await fileToDataURL(f);
      audioEl.src = data; audioEl.play().catch(()=>{});
      save(key, data);
    });
  }
  function fileToDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
})();

// ------------- MEMORIES page logic (gallery) -------------
(function memoriesModule(){
  if(!document.getElementById('memFile')) return;
  const key = 'gallery_list';
  let gallery = load(key, []); // array of {src, title, date, caption}
  const grid = document.getElementById('galleryGrid');
  const memFile = document.getElementById('memFile');
  const memTitle = document.getElementById('memTitle');
  const memDate = document.getElementById('memDate');
  const memCaption = document.getElementById('memCaption');

  function renderGallery(){
    grid.innerHTML = '';
    if(!gallery || gallery.length === 0){ grid.innerHTML = '<div class="col-12 small-muted">No photos yet — add one above.</div>'; return; }
    gallery.slice().reverse().forEach((item, idx)=>{
      const col = document.createElement('div'); col.className = 'col-sm-6 col-md-4';
      col.innerHTML = `<div class="card card-dark">
        <img src="${item.src}" class="gallery-card-img" style="width:100%;height:220px;object-fit:cover;border-radius:8px">
        <div class="p-2">
          <div class="d-flex justify-content-between align-items-start">
            <div><strong>${escapeHtml(item.title||'')}</strong></div>
            <div><small class="small-muted">${escapeHtml(item.date||'')}</small></div>
          </div>
          <p class="small-muted mb-2">${escapeHtml(item.caption||'')}</p>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-light view">View</button>
            <button class="btn btn-sm btn-danger del">Delete</button>
          </div>
        </div>
      </div>`;
      // events
      col.querySelector('.view').onclick = ()=>{
        const modalImg = document.getElementById('modalImg');
        const modalTitle = document.getElementById('modalTitle');
        const modalDate = document.getElementById('modalDate');
        const modalCaption = document.getElementById('modalCaption');
        modalImg.src = item.src; modalTitle.textContent = item.title || ''; modalDate.textContent = item.date || ''; modalCaption.textContent = item.caption || '';
        const modal = new bootstrap.Modal(document.getElementById('photoModal'));
        modal.show();
      };
      col.querySelector('.del').onclick = ()=>{
        if(confirm('Delete this photo?')){ gallery.splice(gallery.length -1 - idx, 1); save(key, gallery); renderGallery(); }
      };
      grid.appendChild(col);
    });
  }

  renderGallery();

  document.getElementById('addPhotoBtn').addEventListener('click', async ()=>{
    const f = memFile.files[0];
    if(!f) return alert('Choose an image file first.');
    const data = await fileToDataURL(f);
    gallery.push({ src: data, title: memTitle.value.trim(), date: memDate.value||new Date().toLocaleDateString(), caption: memCaption.value.trim() });
    save(key, gallery);
    memFile.value=''; memTitle.value=''; memDate.value=''; memCaption.value='';
    renderGallery();
  });

  document.getElementById('clearGallery').addEventListener('click', ()=>{
    if(confirm('Clear entire gallery?')){ gallery = []; save(key, gallery); renderGallery(); }
  });

  // local music (memories page)
  const mUpload = document.getElementById('musicUploadMemories');
  const mAudio = document.getElementById('localAudioMemories');
  const mKey = 'memories_audio';
  const saved = load(mKey);
  if(saved) mAudio.src = saved;
  if(mUpload){
    mUpload.addEventListener('change', async (e)=>{
      const f = e.target.files[0]; if(!f) return;
      const data = await fileToDataURL(f);
      mAudio.src = data; mAudio.play().catch(()=>{});
      save(mKey, data);
    });
  }

  function fileToDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
})();

// ------------- ABOUT page music upload -------------
(function aboutMusic(){
  const upload = document.getElementById('musicUploadAbout');
  const audioEl = document.getElementById('localAudioAbout');
  if(!upload || !audioEl) return;
  const key = 'about_audio';
  const saved = load(key); if(saved) audioEl.src = saved;
  upload.addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const data = await fileToDataURL(f);
    audioEl.src = data; audioEl.play().catch(()=>{});
    save(key, data);
  });
  function fileToDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
})();

// ------------- celebrate and reset bindings (global) -------------
(function globalBindings(){
  const celebrate = document.getElementById('celebrateBtn');
  if(celebrate) celebrate.addEventListener('click', ()=>{ window.nxmHeartsBurst(); });

  const resetBtn = document.getElementById('resetBtn');
  if(resetBtn){
    resetBtn.addEventListener('click', ()=> {
      if(confirm('Clear local NxM data on this device? (messages, gallery, uploaded audios)')){
        // clear keys with prefix
        Object.keys(localStorage).forEach(k => { if(k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k); });
        location.reload();
      }
    });
  }
})();

// ------------- small helper: if user stores images in /images folder (sample images) pre-populate gallery on first run -------------
(function seedSampleImages(){
  const seeded = load('seeded', false);
  if(seeded) return;
  // do not auto-seed if user already has gallery content
  const gallery = load('gallery_list', []);
  if(gallery && gallery.length>0){ save('seeded', true); return; }
  // create 5 sample items pointing to images/img1.jpg ... fallback to remote handled by <img onerror>
  const samples = [
    { src: 'images/img1.jpg', title: 'Our First Date', date: '', caption: 'The beginning of everything.' },
    { src: 'images/img2.jpg', title: 'Sunset Stroll', date: '', caption: 'Hand in hand.' },
    { src: 'images/img3.jpg', title: 'Coffee Kisses', date: '', caption: 'Warm and sweet.' },
    { src: 'images/img4.jpg', title: 'Laughing Together', date: '', caption: 'Joy in small moments.' },
    { src: 'images/img5.jpg', title: 'Always', date: '', caption: 'Forever & always.' }
  ];
  save('gallery_list', samples);
  save('seeded', true);
})();

// End of script.js
