import { CompletionOption, getCompletionDetail } from '../ai/completions'
import { CompletionItemKind } from 'vscode-languageserver-types'
import * as canvasContainer from '../core/canvas-container'
import { activeWindow } from '../core/windows'
import { h, app, Actions } from '../ui/uikit'
import { cursor } from '../core/cursor'
import { Row } from '../styles/common'
import Icon from '../components/icon'
import { translate } from '../ui/css'

interface State {
  options: CompletionOption[],
  vis: boolean,
  ix: number,
  x: number,
  y: number,
  documentation?: string,
  anchorAbove: boolean,
}

interface ShowParams {
  row: number,
  col: number,
  options: CompletionOption[],
}

const MAX_VISIBLE_OPTIONS = 12

const state: State = {
  anchorAbove: false,
  options: [],
  vis: false,
  ix: 0,
  x: 0,
  y: 0,
}

const pos: { container: ClientRect } = {
  container: { left: 0, right: 0, bottom: 0, top: 0, height: 0, width: 0 }
}

const icons = new Map([
  [ CompletionItemKind.Text, Icon('play') ],
  [ CompletionItemKind.Method, Icon('box', { color: '#bb5ef1' }) ],
  [ CompletionItemKind.Property, Icon('disc', { color: '#54c8ff' }) ],
  [ CompletionItemKind.Function, Icon('share-2', { color: '#428aff' }) ],
  [ CompletionItemKind.Constructor, Icon('aperture', { color: '#c9ff56' }) ],
  [ CompletionItemKind.Field, Icon('feather', { color: '#9866ff' }) ],
  [ CompletionItemKind.Variable, Icon('database', { color: '#ff70e4' }) ],
  [ CompletionItemKind.Class, Icon('compass', { color: '#ffeb5b' }) ],
  [ CompletionItemKind.Interface, Icon('map', { color: '#ffa354' }) ],
  [ CompletionItemKind.Module, Icon('grid', { color: '#ff5f54' }) ],
  [ CompletionItemKind.Unit, Icon('cpu', { color: '#ffadc5' }) ],
  [ CompletionItemKind.Value, Icon('bell', { color: '#ffa4d0' }) ],
  [ CompletionItemKind.Enum, Icon('award', { color: '#84ff54' }) ],
  [ CompletionItemKind.Keyword, Icon('navigation', { color: '#ff0c53' }) ],
  [ CompletionItemKind.Snippet, Icon('paperclip', { color: '#0c2dff' }) ],
  [ CompletionItemKind.Color, Icon('eye', { color: '#54ffe5' }) ],
  [ CompletionItemKind.File, Icon('file', { color: '#a5c3ff' }) ],
  [ CompletionItemKind.Reference, Icon('link', { color: '#ffdca3' }) ],
  // TODO: but these exist in the protocol?
  //[ CompletionItemKind.Folder, Icon('folder', { color: '#' }) ],
  //[ CompletionItemKind.EnumMember, Icon('menu', { color: '#' }) ],
  //[ CompletionItemKind.Constant, Icon('triangle', { color: '#' }) ],
  //[ CompletionItemKind.Struct, Icon('layers', { color: '#' }) ],
  //[ CompletionItemKind.Event, Icon('video', { color: '#' }) ],
  //[ CompletionItemKind.Operator, Icon('anchor', { color: '#' }) ],
  //[ CompletionItemKind.TypeParameter, Icon('type', { color: '#' }) ],
])

const getCompletionIcon = (kind: CompletionItemKind) => icons.get(kind) || Icon('code')

const docs = (data: string) => Row.normal({
  style: {
    overflow: 'visible',
    whiteSpace: 'normal',
    background: 'var(--background-45)',
    color: 'var(--foreground-20)',
    paddingTop: '4px',
    paddingBottom: '4px',
    fontSize: `${canvasContainer.font.size - 2}px`,
  }
}, data)

const view = ({ options, anchorAbove, documentation, vis, ix, x, y }: State) => h('#autocomplete', {
  hide: !vis,
  style: {
    zIndex: 200,
    minWidth: '100px',
    maxWidth: '600px',
    position: 'absolute',
    transform: translate(x, y),
  }
}, [
  ,h('div', {
    transform: anchorAbove ? 'translateY(-100%)' : undefined,
  }, [
    ,documentation && anchorAbove && docs(documentation)

    ,h('div', {
      onupdate: (e: HTMLElement) => pos.container = e.getBoundingClientRect(),
      style: {
        background: 'var(--background-30)',
        //transformOrigin: anchorAbove ? 'left bottom' : 'left top',
        transform: anchorAbove ? 'translateY(-100%)' : undefined,
        overflowY: 'hidden',
        maxHeight: `${canvasContainer.cell.height * MAX_VISIBLE_OPTIONS}px`,
      }
    }, options.map(({ text, kind }, id) => Row.complete({
      key: id,
      activeWhen: id === ix,
      onupdate: (e: HTMLElement) => {
        if (id !== ix) return
        const { top, bottom } = e.getBoundingClientRect()
        if (top < pos.container.top) return e.scrollIntoView(true)
        if (bottom > pos.container.bottom) return e.scrollIntoView(false)
      },
    }, [
      ,h('div', {
        style: {
          display: 'flex',
          marginLeft: '-8px',
          background: 'rgba(255, 255, 255, 0.03)',
          // TODO: this doesn't scale with font size?
          width: '24px',
          marginRight: '8px',
          alignItems: 'center',
          justifyContent: 'center',
        }
      }, [
        getCompletionIcon(kind),
      ])

      ,h('div', text)
    ])))

    ,documentation && !anchorAbove && docs(documentation)
  ])
])

const a: Actions<State> = {}

a.show = (_s, _a, { anchorAbove, options, x, y, ix = -1 }) => ({ anchorAbove, options, ix, x, y, vis: true, documentation: undefined })
a.showDocs = (_s, _a, documentation) => ({ documentation })
a.hide = () => ({ vis: false, ix: 0 })
a.select = (s, a, ix: number) => {
  const completionItem = (s.options[ix] || {}).raw

  if (completionItem) getCompletionDetail(completionItem)
    .then(m => m.documentation && a.showDocs(m.documentation))

  return { ix, documentation: undefined }
}

const ui = app({ state, view, actions: a }, false)

export const hide = () => ui.hide()
export const select = (index: number) => ui.select(index)
export const showDocs = (documentation: string) => ui.showDocs(documentation)
export const show = ({ row, col, options }: ShowParams) => {
  const visibleOptions = Math.min(MAX_VISIBLE_OPTIONS, options.length)
  const anchorAbove = cursor.row + visibleOptions > canvasContainer.size.rows 

  ui.show({
    options,
    anchorAbove,
    x: activeWindow() ? activeWindow()!.colToX(col) : 0,
    y: activeWindow() ? activeWindow()!.rowToTransformY(anchorAbove ? row : row + 1) : 0,
  })
}
