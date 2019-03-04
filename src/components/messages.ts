import { registerOneTimeUseShortcuts } from '../core/input'
import { MessageKind, Message } from '../protocols/veonim'
import * as Icon from 'hyperapp-feather'
import { uuid } from '../support/utils'
import { colors } from '../ui/styles'
import { h, app } from '../ui/uikit'
import { cvar } from '../ui/css'
export { MessageKind } from '../protocols/veonim'

enum MessageSource {
  Neovim,
  VSCode,
}

interface MessageAction {
  label: string
  shortcut: string
  shortcutLabel: string
}

interface IMessage {
  id: string
  source: MessageSource
  kind: MessageKind
  message: string
  actions: MessageAction[]
  onAction: (action: string) => void
}

const state = {
  messages: [] as IMessage[],
}

type S = typeof state

const renderIcons = new Map([
  [ MessageKind.Error, Icon.XCircle ],
  [ MessageKind.Warning, Icon.AlertTriangle ],
  [ MessageKind.Success, Icon.CheckCircle ],
  [ MessageKind.Info, Icon.MessageCircle ],
  [ MessageKind.System, Icon.AlertCircle ],
])

const getIcon = (kind: MessageKind) => renderIcons.get(kind)!

const actions = {
  addMessage: (message: IMessage) => (s: S) => ({
    messages: [message, ...s.messages],
  }),
  removeMessage: (id: string) => (s: S) => ({
    messages: s.messages.filter(m => m.id !== id),
  }),
  clearMessages: (source: MessageSource) => (s: S) => ({
    messages: s.messages.filter(m => m.source !== source),
  }),
}

type A = typeof actions

const MessageView = ({ kind, message, actions }: IMessage, last: boolean) => h('div', {
  style: {
    display: 'flex',
    marginTop: '4px',
    padding: '16px 18px',
    background: cvar('background-30'),
    borderLeft: '4px solid',
    borderColor: Reflect.get(colors, kind),
    fontSize: '1.2rem',
    flexFlow: 'column',
  },
}, [

  ,h('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
    }
  }, [

    ,h('div', {
      style: {
        display: 'flex',
        paddingRight: '14px',
        alignItems: 'center',
        fontSize: '1.6rem',
        color: Reflect.get(colors, kind),
      }
    }, [
      ,h(getIcon(kind))
    ])

    ,h('span', {
      style: {
        color: cvar('foreground-10'),
      }
    }, message)

  ])

  ,last && h('div', {
    style: {
      marginTop: '12px',
      display: 'flex',
      justifyContent: 'flex-end',
    }
  }, actions.map(a => Action(a.label, a.shortcutLabel)))

])

// TODO: create a highlight color from vim colorscheme
// const highlightColor = 'rgb(87, 52, 121)'
const highlightColor = 'rgb(78, 56, 100)'

const Action = (label: string, shortcut: string) => h('div', {
  style: {
    marginLeft: '10px',
  }
}, [

  ,h('div', {
    style: {
      display: 'flex',
    }
  }, [

    ,h('div', {
      style: {
        borderRadius: '2px',
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        padding: '5px 10px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: highlightColor,
        color: cvar('foreground'),
        border: 'none',
        clipPath: 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
        paddingRight: '20px',
        marginRight: '-12px',
        fontSize: '1rem',
      }
    }, label)

    ,h('div', {
      style: {
        clipPath: 'polygon(12px 0, 100% 0, 100% 100%, 0 100%)',
        color: cvar('foreground-20'),
        borderRadius: '2px',
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        background: 'none',
        padding: '5px 10px',
        border: '1px solid',
        borderColor: highlightColor,
        display: 'flex',
        borderLeft: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.86rem',
        fontWeight: 'bold',
        paddingLeft: '20px',
      }
    }, shortcut)

  ])

])

const view = ($: S) => h('div', {
  style: {
    display: 'flex',
    height: '100%',
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  }
}, [

  ,h('div', {
    style: {
      display: 'flex',
      flexFlow: 'column',
      maxWidth: '500px',
      minWidth: '350px',
    }
  }, [

    ,void registerFirstMessageShortcuts($.messages[$.messages.length - 1])
    ,$.messages.map((m, ix) => MessageView(m, ix === $.messages.length - 1))

  ])

])

// will there be more than 6 message actions?
const availableShortcuts = [
  { shortcutLabel: 'C S Y', shortcut: '<S-C-y>' },
  { shortcutLabel: 'C S T', shortcut: '<S-C-t>' },
  { shortcutLabel: 'C S U', shortcut: '<S-C-u>' },
  { shortcutLabel: 'C S R', shortcut: '<S-C-r>' },
  { shortcutLabel: 'C S E', shortcut: '<S-C-e>' },
  { shortcutLabel: 'C S W', shortcut: '<S-C-e>' },
]

const getShortcut = (index: number) => availableShortcuts[index] || {
  shortcutLabel: '???',
  shortcut: '',
}

const registerFirstMessageShortcuts = (message: IMessage) => {
  if (!message) return

  const shortcuts = message.actions.map(m => m.shortcut)
  registerOneTimeUseShortcuts(shortcuts, shortcut => {
    const action = message.actions.find(m => m.shortcut === shortcut)
    if (action) message.onAction(action.label)
  })
}

const ui = app<S, A>({ name: 'messages', state, actions, view })

const addMessage = (source: MessageSource, message: Message, onAction?: (action: string) => void) => {
  const id = uuid()

  const registeredActions = message.actions || []
  if (registeredActions.length > 6) console.error('messages: more than 6 actions - not enough shortcuts!')
  const actions = registeredActions.map((label, ix) => ({ ...getShortcut(ix), label }))

  // generic close/dismiss message functionality - like the (x) button in the prompt
  actions.push({
    label: 'Dismiss',
    shortcutLabel: 'C S N',
    shortcut: '<S-C-n>',
  })

  const callback = (action: string) => {
    ui.removeMessage(id)
    if (typeof onAction === 'function') onAction(action)
  }

  ui.addMessage({
    ...message,
    id,
    source,
    actions,
    onAction: callback,
  })

  return () => ui.removeMessage(id)
}

export default {
  neovim: {
    add: (message: Message, onAction?: (action: string) => void) => {
      addMessage(MessageSource.Neovim, message, onAction)
    },
    clear: () => ui.clearMessages(MessageSource.Neovim),
  },
  vscode: {
    add: (message: Message, onAction?: (action: string) => void) => {
      addMessage(MessageSource.Neovim, message, onAction)
    },
    clear: () => ui.clearMessages(MessageSource.VSCode),
  },
}
