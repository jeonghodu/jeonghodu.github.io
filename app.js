(()=>{
  'use strict';
  const page=document.body.dataset.page;
  if(!['writing','projects','post','contact'].includes(page))return;

  // Publishable key: safe for a public site. Never put a secret/service_role key here.
  const SUPABASE_URL='https://hlichvobeqkaluwcimod.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_OOeZMF3jXV_A8ydqQS1x7w_Ghih7OhU';
  const client=window.supabase?window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY):null;
  const params=new URLSearchParams(location.search);
  const category=page==='post'?params.get('category'):page;
  const requestedId=page==='post'?params.get('id'):null;
  let isAdmin=false,currentPost=null;

  const el=(tag,className,content)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(content!==undefined)node.textContent=content;
    return node;
  };
  const button=(label,action,className='text-button')=>{
    const node=el('button',className,label);
    node.type='button';node.addEventListener('click',action);return node;
  };
  const date=value=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium'}).format(new Date(value));
  async function rpc(name,args={}){
    if(!client)throw new Error('Supabase 스크립트를 불러오지 못했습니다. 새로고침해 주세요.');
    const {data,error}=await client.rpc(name,args);
    if(error)throw error;
    return data;
  }
  function showError(target,error){target.replaceChildren(el('p','form-error',error.message||'잠시 후 다시 시도해 주세요.'));}

  async function loadList(){
    const target=document.querySelector('#post-list');
    try{
      const posts=await rpc('list_posts',{p_category:category});
      const list=el('div','title-list');
      for(const post of posts){
        const row=el('article','title-row'),link=el('a');
        link.href=`post.html?category=${category}&id=${post.id}`;
        link.append(el('span','',post.title),el('span','','↗'));
        row.append(link);list.append(row);
      }
      target.replaceChildren(list);
      if(!posts.length){
        const empty=el('div','empty-state');
        empty.append(el('span','eyebrow','COMING SOON'),el('h3','',category==='projects'?'첫 프로젝트를 준비 중입니다.':'첫 글을 준비 중입니다.'));
        empty.append(el('p','muted',category==='projects'?'진행 중인 공부와 실험을 곧 이곳에 기록할게요. 그동안 글을 둘러보세요.':'새 글이 공개되면 여기서 제목을 확인할 수 있습니다.'));
        if(category==='projects'){const link=el('a','pill secondary','글 보러 가기 ↗');link.href='writing.html';empty.append(link);}
        target.replaceChildren(empty);
      }
    }catch(error){showError(target,error);}
  }

  function compose(){
    if(!isAdmin)return;
    const target=document.querySelector('#editor'),list=document.querySelector('#post-list');
    const form=el('form','form-panel');form.append(el('h3','',category==='writing'?'새 글':'새 프로젝트'));
    const title=el('input'),body=el('textarea'),error=el('p','form-error');
    title.required=true;title.maxLength=120;body.required=true;body.rows=14;body.maxLength=30000;
    const titleLabel=el('label','','제목'),bodyLabel=el('label','','내용');
    titleLabel.append(title);bodyLabel.append(body);
    const submit=el('button','button','게시');submit.type='submit';
    const actions=el('div','actions');
    const close=()=>{target.replaceChildren();target.hidden=true;list.hidden=false;document.querySelector('#compose').hidden=!isAdmin;};
    actions.append(submit,button('취소',close,'button ghost'));
    form.append(titleLabel,bodyLabel,actions,error);target.replaceChildren(form);
    target.hidden=false;list.hidden=true;document.querySelector('#compose').hidden=true;title.focus();
    form.addEventListener('submit',async event=>{
      event.preventDefault();submit.disabled=true;error.textContent='';
      try{
        await rpc('save_post',{p_id:null,p_category:category,p_title:title.value.trim(),p_body:body.value.trim()});
        close();await loadList();
      }catch(e){error.textContent=e.message;submit.disabled=false;}
    });
  }

  async function loadPost(){
    if(!['writing','projects'].includes(category)||!/^[1-9]\d*$/.test(requestedId||''))throw new Error('글 주소가 올바르지 않습니다.');
    const posts=await rpc('list_posts',{p_category:category});
    currentPost=posts.find(post=>String(post.id)===requestedId);
    if(!currentPost)throw new Error('글을 찾을 수 없습니다. 목록으로 돌아가 확인해 주세요.');
    document.title=`${currentPost.title} — JEONG HODU`;
    document.querySelector('#back-to-list').href=`${category}.html`;
    document.querySelector('#back-to-list').textContent=category==='writing'?'← 글 목록으로':'← 프로젝트 목록으로';
    document.querySelector(`.nav-links a[href="${category}.html"]`)?.setAttribute('aria-current','page');
    document.querySelector('#post-category').textContent=category.toUpperCase();
    document.querySelector('#post-title').textContent=currentPost.title;
    document.querySelector('#post-date').textContent=date(currentPost.created_at);
    document.querySelector('#post-body').textContent=currentPost.body;
    document.querySelector('#post').hidden=false;
    document.querySelector('#post-actions').hidden=!isAdmin;
    await renderComments(document.querySelector('#comments'),category,currentPost.id);
  }

  function editPost(){
    if(!isAdmin||!currentPost)return;
    const target=document.querySelector('#editor'),form=el('form','form-panel');
    form.append(el('h3','','글 수정'));
    const title=el('input'),body=el('textarea'),error=el('p','form-error');
    title.value=currentPost.title;title.required=true;title.maxLength=120;
    body.value=currentPost.body;body.required=true;body.rows=14;body.maxLength=30000;
    const titleLabel=el('label','','제목'),bodyLabel=el('label','','내용');
    titleLabel.append(title);bodyLabel.append(body);
    const actions=el('div','actions'),submit=el('button','button','수정 저장');submit.type='submit';
    actions.append(submit,button('취소',()=>target.replaceChildren(),'button ghost'));
    form.append(titleLabel,bodyLabel,actions,error);target.replaceChildren(form);title.focus();
    form.addEventListener('submit',async event=>{
      event.preventDefault();submit.disabled=true;error.textContent='';
      try{
        await rpc('save_post',{p_id:currentPost.id,p_category:category,p_title:title.value.trim(),p_body:body.value.trim()});
        target.replaceChildren();await loadPost();
      }catch(e){error.textContent=e.message;submit.disabled=false;}
    });
  }
  async function deletePost(){
    if(!isAdmin||!currentPost||!confirm('이 글과 모든 댓글을 삭제할까요? 되돌릴 수 없습니다.'))return;
    try{await rpc('remove_post',{p_id:currentPost.id});location.href=`${category}.html`;}
    catch(e){alert(e.message);}
  }

    async function renderComments(
      target,category,postId=null
    ) {
      target.replaceChildren(
        el('h3','','댓글'),
        el('p','muted',
          '불특정 다수가 볼 수 있습니다. ' +
          '닉네임·비밀번호로 나중에 수정하거나 삭제할 수 있습니다.')
      );

      if(category==='contact'){
        const write=button('방명록 남기기 ↗',()=>showCommentForm(target,category,postId,null,'새 방명록'),'button');
        write.classList.add('comment-start');
        target.append(write);
      }

      const list = el('div','comment-list');
      target.append(list);

      try {
        const comments = await rpc('list_comments',{
          p_category:category,
          p_post_id:postId
        });

        target.querySelector('h3').textContent =
          category === 'contact'
            ? `방명록 (${comments.length})`
            : `댓글 (${comments.length})`;

        if(!comments.length) {
          list.append(
            el('p','empty','첫 메시지를 남겨 주세요.')
          );
        }

        const byParent = new Map();
        for(const c of comments) {
          const key = c.parent_id || 0;
          if(!byParent.has(key)) byParent.set(key,[]);
          byParent.get(key).push(c);
        }

        function addChildren(parent,depth=0) {
          for(const c of byParent.get(parent) || []) {
            const card = el(
              'article',
              'comment' + (depth ? ' reply' : '')
            );
            const head = el('div','comment-head');
            head.append(
              el('strong','',c.nickname),
              el('time','',
                date(c.created_at) +
                (c.updated_at !== c.created_at
                  ? ' · 수정됨' : '')
              )
            );
            const content=el('p','',c.body);
            card.append(head,content);
            if(c.body.length>360){
              content.classList.add('comment-preview');
              const expand=button('더 보기',()=>{
                const expanded=content.classList.toggle('expanded');
                expand.textContent=expanded?'접기':'더 보기';
                expand.setAttribute('aria-expanded',String(expanded));
              });
              expand.setAttribute('aria-expanded','false');
              card.append(expand);
            }

            const actions = el('div','actions');
            if(depth === 0) {
              actions.append(
                button('답글',() =>
                  showCommentForm(
                    target,category,postId,c.id,
                    `@${c.nickname} 답글`
                  )
                )
              );
            }
            actions.append(
              button('수정',() =>
                showManageForm(
                  card,c,false,
                  () => renderComments(
                    target,category,postId
                  )
                )
              )
            );
            actions.append(
              button('삭제',() =>
                showManageForm(
                  card,c,true,
                  () => renderComments(
                    target,category,postId
                  )
                )
              )
            );

            card.append(actions);
            list.append(card);
            addChildren(c.id,depth+1);
          }
        }
        addChildren(0);
      } catch(e) {
        list.append(el('p','form-error',e.message));
      }

      target.append(
        button(
          '댓글 남기기',
          () => showCommentForm(
            target,category,postId,null,'새 댓글'
          ),
          'button ghost'
        )
      );
    }

    function showCommentForm(
      target,category,postId,parentId,title
    ) {
      target.querySelector('.comment-form')?.remove();

      const form = el('form','form-panel comment-form');
      form.append(el('h3','',title));

      const row = el('div','row');
      const nWrap = el('div','grow');
      const pWrap = el('div','grow');
      const nick = el('input');
      const pass = el('input');
      const body = el('textarea');
      const error = el('p','form-error');

      nick.placeholder = '닉네임 (2~24자)';
      nick.required = true;
      nick.maxLength = 24;

      pass.placeholder =
        '수정·삭제용 비밀번호 (8자 이상)';
      pass.type = 'password';
      pass.required = true;
      pass.minLength = 8;
      pass.autocomplete = 'new-password';

      nWrap.append(el('label','','닉네임'),nick);
      pWrap.append(el('label','','비밀번호'),pass);
      row.append(nWrap,pWrap);

      body.placeholder = '메시지 (최대 2000자)';
      body.required = true;
      body.maxLength = 2000;

      const bodyLabel = el('label','','내용');
      bodyLabel.append(body);

      const submit = el('button','button','등록');
      submit.type = 'submit';
      const actions = el('div','actions');
      actions.append(
        submit,
        button('취소',() => form.remove())
      );

      form.append(row,bodyLabel,actions,error);
      target.append(form);
      form.scrollIntoView({
        block:'nearest',behavior:'smooth'
      });
      nick.focus();

      form.addEventListener('submit',async event => {
        event.preventDefault();
        submit.disabled = true;
        error.textContent = '';

        try {
          await rpc('add_comment',{
            p_category:category,
            p_post_id:postId,
            p_parent_id:parentId,
            p_nickname:nick.value.trim(),
            p_password:pass.value,
            p_body:body.value.trim()
          });
          await renderComments(target,category,postId);
        } catch(e) {
          error.textContent = e.message;
          submit.disabled = false;
        }
      });
    }

    function showManageForm(
      card,c,deleting,refresh
    ) {
      card.querySelector('.manage-form')?.remove();

      const form = el('form','form-panel manage-form');
      form.append(
        el('h3','',
          deleting ? '댓글 삭제' : '댓글 수정'
        )
      );

      const pass = el('input');
      const error = el('p','form-error');
      pass.type = 'password';
      pass.placeholder = isAdmin
        ? '관리자라면 비워도 됩니다'
        : '작성할 때 입력한 비밀번호';
      pass.autocomplete = 'current-password';
      pass.required = !isAdmin;

      const passLabel =
        el('label','','댓글 비밀번호');
      passLabel.append(pass);
      form.append(passLabel);

      let body;
      if(!deleting) {
        body = el('textarea');
        body.value = c.body;
        body.required = true;
        body.maxLength = 2000;
        const label = el('label','','수정 내용');
        label.append(body);
        form.append(label);
      }

      const actions = el('div','actions');
      const submit = el(
        'button','button',
        deleting ? '삭제 확인' : '저장'
      );
      submit.type = 'submit';
      actions.append(
        submit,
        button('취소',() => form.remove())
      );
      form.append(actions,error);
      card.append(form);
      (deleting ? pass : body).focus();

      form.addEventListener('submit',async event => {
        event.preventDefault();
        submit.disabled = true;
        error.textContent = '';

        try {
          const result =
            await rpc('manage_comment',{
              p_id:c.id,
              p_password:pass.value,
              p_body:deleting
                ? null
                : body.value.trim(),
              p_delete:deleting
            });

          if(result === 'ok') {
            await refresh();
          } else {
            error.textContent = ({
              wrong_password:
                '비밀번호가 일치하지 않습니다.',
              locked:
                '비밀번호 오류가 많아 15분 후 다시 시도할 수 있습니다.',
              not_found:
                '댓글을 찾을 수 없습니다.',
              invalid:
                '내용을 확인해 주세요.'
            })[result] || '다시 시도해 주세요.';
            submit.disabled = false;
          }
        } catch(e) {
          error.textContent = e.message;
          submit.disabled = false;
        }
      });
    }



  async function refreshAdmin(){
    try{isAdmin=!!(await rpc('am_i_admin'));}catch{isAdmin=false;}
    const composeButton=document.querySelector('#compose'),actions=document.querySelector('#post-actions');
    if(composeButton)composeButton.hidden=!isAdmin;
    if(actions)actions.hidden=!isAdmin;
    document.querySelector('#admin-toggle').textContent=isAdmin?'관리자 로그아웃':'관리자 로그인';
    document.querySelector('#admin-status').textContent=isAdmin?'관리자로 로그인됨':'';
    document.querySelector('#login-form').hidden=true;
  }
  function setupAdmin(){
    document.querySelector('#admin-toggle').addEventListener('click',async()=>{
      if(isAdmin){await client.auth.signOut();await refreshAdmin();}
      else{const form=document.querySelector('#login-form');form.hidden=!form.hidden;}
    });
    document.querySelector('#login-form').addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget,submit=form.querySelector('[type=submit]'),errorBox=form.querySelector('#login-error');
      submit.disabled=true;errorBox.textContent='';
      try{
        if(!client)throw new Error('Supabase 연결을 확인해 주세요.');
        const {error}=await client.auth.signInWithPassword({email:form.querySelector('#admin-email').value,password:form.querySelector('#admin-password').value});
        if(error)throw error;form.querySelector('#admin-password').value='';
        await refreshAdmin();
        if(!isAdmin){await client.auth.signOut();throw new Error('이 계정은 관리자 권한이 없습니다.');}
      }catch(e){errorBox.textContent=e.message;form.hidden=false;}finally{submit.disabled=false;}
    });
  }

  async function init(){
    if(page==='writing'||page==='projects')document.querySelector('#compose').addEventListener('click',compose);
    if(page==='post'){
      document.querySelector('#edit-post').addEventListener('click',editPost);
      document.querySelector('#delete-post').addEventListener('click',deletePost);
      document.querySelector('#share-post').addEventListener('click',async event=>{
        const control=event.currentTarget;
        try{
          await navigator.clipboard.writeText(location.href);
          control.textContent='복사 완료 ✓';
          setTimeout(()=>{control.textContent='링크 복사 ↗';},2400);
        }catch{
          control.textContent='주소창에서 링크를 복사해 주세요';
          setTimeout(()=>{control.textContent='링크 복사 ↗';},3000);
        }
      });
    }
    if(page!=='contact')setupAdmin();
    if(page==='writing'||page==='projects')await loadList();
    if(page==='contact')await renderComments(document.querySelector('#comments'),'contact');
    if(page==='post'){
      try{await loadPost();}catch(e){document.querySelector('#page-error').textContent=e.message;}
    }
    if(page!=='contact'&&client){
      const {data}=await client.auth.getSession();
      if(data.session)await refreshAdmin();
    }
  }
  init();
})();
