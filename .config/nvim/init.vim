call plug#begin('~/.local/share/nvim/plugged')

Plug 'junegunn/fzf', {'dir': '~/.fzf', 'do': './install --all'}
Plug 'airblade/vim-gitgutter'
Plug 'chriskempson/base16-vim'
Plug 'tpope/vim-commentary'
Plug 'tpope/vim-fugitive'
Plug 'neoclide/coc.nvim', {'do': 'yarn install --frozen-lockfile'}
Plug 'leafgarland/typescript-vim'
Plug 'MaxMEllon/vim-jsx-pretty'

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

" colorscheme
let base16colorspace=256
colorscheme base16-horizon-dark
" darken error highlight color
highlight Error ctermbg=088
highlight SpellBad ctermbg=088

" shortcuts
" fuzzy file finder
nnoremap <C-P> :FZF<Enter>
" errors list
nnoremap <C-Space> :lopen<Enter>
" rename symbol
nmap <F2> <Plug>(coc-rename)

" tsx
autocmd BufNewFile,BufRead *.tsx set filetype=typescript.tsx
