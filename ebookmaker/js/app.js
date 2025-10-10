// app.js - Mobile-first eBook maker with PDF export (html2pdf)
const $ = id => document.getElementById(id);

const book = { title: 'My eBook', author: 'Anonymous', language: 'en', chapters: [] };

const openSidebarBtn = $('openSidebar');
const closeSidebarBtn = $('closeSidebar');
const sidebar = $('sidebar');
const chaptersList = $('chaptersList');
const addChapterBtn = $('addChapterBtn');
const saveChapterBtn = $('saveChapterBtn');
const chapterTitleInput = $('chapterTitle');
const chapterContent = $('chapterContent');
const imageInput = $('imageInput');
const previewArea = $('previewArea');
const exportPdfBtn = $('exportPdfBtn');
const bookTitleInput = $('bookTitle');
const bookAuthorInput = $('bookAuthor');

// Sidebar toggle
openSidebarBtn.addEventListener('click', () => { sidebar.classList.add('open'); sidebar.setAttribute('aria-hidden','false'); });
closeSidebarBtn.addEventListener('click', () => { sidebar.classList.remove('open'); sidebar.setAttribute('aria-hidden','true'); });

// Helpers
function escapeHtml(s){ if(!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderChapters(){
  chaptersList.innerHTML = '';
  book.chapters.forEach((ch, idx) => {
    const row = document.createElement('div');
    row.className = 'chapter-item';
    row.innerHTML = `
      <div class="meta">
        <strong>${escapeHtml(ch.title || 'Untitled')}</strong>
        <div class="muted">${(stripHtml(ch.content||'')).slice(0,80)}${(ch.content||'').length>80?'...':''}</div>
      </div>
      <div class="controls">
        <button class="btn" data-action="edit" data-idx="${idx}">Edit</button>
        <button class="btn" data-action="up" data-idx="${idx}">↑</button>
        <button class="btn" data-action="down" data-idx="${idx}">↓</button>
        <button class="btn" data-action="delete" data-idx="${idx}">✕</button>
      </div>
    `;
    chaptersList.appendChild(row);
  });
  updatePreview();
}

// strip HTML for preview excerpt
function stripHtml(html){
  const tmp = document.createElement('div'); tmp.innerHTML = html; return tmp.textContent || tmp.innerText || '';
}

// delegated actions
chaptersList.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const action = btn.dataset.action;
  const idx = Number(btn.dataset.idx);
  if(action === 'edit') editChapter(idx);
  if(action === 'up') moveChapter(idx, -1);
  if(action === 'down') moveChapter(idx, 1);
  if(action === 'delete') { if(confirm('Delete this chapter?')) { deleteChapter(idx); } }
});

function editChapter(i){
  const ch = book.chapters[i];
  if(!ch) return;
  chapterTitleInput.value = ch.title;
  chapterContent.value = ch.content;
  saveChapterBtn.dataset.editIndex = i;
  // close sidebar on mobile for editor focus
  sidebar.classList.remove('open');
}

function moveChapter(i, dir){
  const j = i + dir; if(j < 0 || j >= book.chapters.length) return;
  [book.chapters[i], book.chapters[j]] = [book.chapters[j], book.chapters[i]];
  renderChapters();
}

function deleteChapter(i){
  book.chapters.splice(i, 1);
  renderChapters();
}

addChapterBtn.addEventListener('click', () => {
  book.chapters.push({ id: Date.now(), title: 'Untitled', content: '', images: [] });
  renderChapters();
});

// Save / update chapter
saveChapterBtn.addEventListener('click', () => {
  const idx = saveChapterBtn.dataset.editIndex;
  const title = chapterTitleInput.value.trim() || 'Untitled';
  const content = chapterContent.value;
  if(idx || idx === '0') {
    book.chapters[Number(idx)].title = title;
    book.chapters[Number(idx)].content = content;
  } else {
    book.chapters.push({ id: Date.now(), title, content, images: [] });
  }
  // reset
  saveChapterBtn.dataset.editIndex = '';
  chapterTitleInput.value = '';
  chapterContent.value = '';
  renderChapters();
});

// Image upload attaches to current editing chapter (or creates a new chapter)
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const idx = saveChapterBtn.dataset.editIndex;
    if(idx || idx === '0') {
      const ch = book.chapters[Number(idx)];
      ch.images = ch.images || [];
      ch.images.push({ name: file.name, dataUrl });
    } else {
      book.chapters.push({ id: Date.now(), title: 'Untitled', content: '', images: [{ name: file.name, dataUrl }] });
    }
    renderChapters();
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

// Preview generation
function generatePreviewHtml(){
  const title = bookTitleInput.value || book.title;
  const author = bookAuthorInput.value || book.author;
  let html = `<div style="max-width:900px;margin:auto;font-family:Arial,Helvetica,sans-serif;color:#04203a">`;
  html += `<h1 style="margin-bottom:0.1em">${escapeHtml(title)}</h1><p style="margin-top:0;color:#555">${escapeHtml(author)}</p>`;
  book.chapters.forEach((ch, idx) => {
    html += `<hr style="border:none;border-top:1px solid #ddd;margin:18px 0">`;
    html += `<h2>${escapeHtml(ch.title)}</h2>`;
    // content is allowed as HTML (user-provided). We insert as-is.
    html += `<div>${ch.content || ''}</div>`;
    if(ch.images && ch.images.length){
      ch.images.forEach(img => {
        html += `<div style="margin-top:10px"><img src="${img.dataUrl}" style="max-width:100%;height:auto"></div>`;
      });
    }
  });
  html += `</div>`;
  return html;
}

function updatePreview(){
  previewArea.innerHTML = generatePreviewHtml();
}

// PDF export using html2pdf
async function exportPdf(){
  if(book.chapters.length === 0){
    alert('Add at least one chapter before exporting.');
    return;
  }
  // refresh preview to ensure up-to-date
  updatePreview();

  // filename
  const filename = (bookTitleInput.value || book.title || 'ebook').replace(/[^a-z0-9_\-]/gi, '_') + '.pdf';

  // html2pdf options (good defaults for long documents)
  const opt = {
    margin:       12,              // mm
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.92 },
    html2canvas:  { scale: 2, useCORS: true, allowTaint: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['css', 'legacy'] }
  };

  // Option: temporarily clone the preview and remove anything unwanted
  const element = previewArea.cloneNode(true);
  // set white background for printing
  element.style.background = '#ffffff';
  element.style.padding = '16px';

  // html2pdf from element
  try {
    await html2pdf().set(opt).from(element).save();
  } catch (err) {
    console.error('PDF export failed', err);
    alert('PDF export failed. Check console for details.');
  }
}

// wire export
exportPdfBtn.addEventListener('click', exportPdf);

// wire title/author inputs
bookTitleInput.addEventListener('change', () => book.title = bookTitleInput.value);
bookAuthorInput.addEventListener('change', () => book.author = bookAuthorInput.value);

// seed with a sample chapter
book.chapters.push({ id: Date.now(), title: 'Introduction', content: '<p>Welcome to your eBook — write chapters, add images, then export to PDF.</p>', images: [] });
renderChapters();

// small autosave of preview to keep it live
setInterval(updatePreview, 1200);
