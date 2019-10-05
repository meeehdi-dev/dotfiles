call plug#begin('~/.local/share/nvim/plugged')

Plug 'junegunn/fzf', {'dir': '~/.fzf', 'do': './install --all'}
Plug 'Shougo/deoplete.nvim', {'do': ':UpdateRemotePlugins'}
Plug 'dense-analysis/ale'
Plug 'airblade/vim-gitgutter'
Plug 'HerringtonDarkholme/yats.vim'
Plug 'mhartington/nvim-typescript', {'do': './install.sh'}
Plug 'prettier/vim-prettier', { 'do': 'yarn install' }
Plug 'othree/html5.vim'
Plug 'chriskempson/base16-vim'
Plug 'tpope/vim-commentary'
Plug 'tpope/vim-fugitive'

call plug#end()

set expandtab " spaces instead of tabs
set hlsearch " highlight all results
set mouse=a " enable mouse
set noruler " remove bottom right infos
set nowrap " don't wrap lines (duh!)
set number " line numbers
set shiftwidth=2 " 1 tab = 2 spaces
set signcolumn=yes " avoid flicker due to GitGutter & ALE
set softtabstop=2 " 1 tab = 2 spaces (deja vu)
set statusline=%F " always show file path in status bar
set updatetime=200 " update every 200ms (for ALE)

" colorscheme
let base16colorspace=256
colorscheme base16-horizon-dark
" darken error highlight color
highlight Error ctermbg=088
highlight SpellBad ctermbg=088

" Deoplete
let g:deoplete#enable_at_startup = 1

" typescript
autocmd FileType typescript nnoremap <C-O> :TSImport<Enter>
autocmd FileType typescript nnoremap <A-O> :TSOrganizeImports<Enter>
autocmd FileType typescript nnoremap <C-D> :TSDef<Enter>
" tsx
autocmd BufNewFile,BufRead *.tsx set filetype=typescript
autocmd FileType typescript set omnifunc=xmlcomplete#CompleteTags
" ALE
let g:ale_linters_explicit = 1
let g:ale_fix_on_save = 1
let g:ale_linters = {
      \ 'javascript': ['eslint'],
      \ 'typescript': ['eslint'],
      \ }
let g:ale_fixers = {
      \ 'javascript': ['eslint'],
      \ 'typescript': ['eslint'],
      \ }

" prettier
let g:prettier#quickfix_enabled = 0
let g:prettier#autoformat = 0
autocmd BufWritePre,InsertLeave *.js,*.jsx,*.ts,*.tsx,*.css,*.scss,*.json,*.html PrettierAsync

" shortcuts
" format
nnoremap <C-F> :PrettierAsync<Enter>
" fuzzy file finder
nnoremap <C-P> :FZF<Enter>
" back to previous buffer
nnoremap <C-S> :bprevious<Enter>
" errors list
nnoremap <C-Space> :lopen<Enter>
