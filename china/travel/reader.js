const viewer = document.querySelector('dialog');
if(viewer && viewer.showModal){
  document.addEventListener('click', event => {
    const link = event.target.closest('a.photo');
    if(!link) return;
    event.preventDefault();
    viewer.querySelector('img').src = link.href;
    viewer.showModal();
  });
  viewer.addEventListener('click', event => { if(event.target === viewer) viewer.close(); });
}
