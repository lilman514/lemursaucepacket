// LemurSaucePacket: the in-game guide (a Patchouli book generated from the wiki by publish/patchouli.mjs).
// New players get one; /guide opens it from anywhere (the ESC menu's Guide button runs that); it's craftable.

const GUIDE_BOOK = 'lemursaucepacket:guide'

const guideBookItem = () => Item.of('patchouli:guide_book', { 'patchouli:book': GUIDE_BOOK })

PlayerEvents.loggedIn((event) => {
  let player = event.player
  if (player.persistentData.getBoolean('lsp_guide_given')) return
  player.persistentData.putBoolean('lsp_guide_given', true)
  player.give(guideBookItem())
  player.tell(Text.gray("You've been handed the LemurSaucePacket Guide. Press ESC → Guide any time to read it."))
})

ServerEvents.recipes((event) => {
  event.shapeless(guideBookItem(), ['minecraft:book', 'create:brass_nugget']).id('lemursaucepacket:guide_book')
})

ServerEvents.commandRegistry((event) => {
  const Commands = event.commands
  event.register(
    Commands.literal('guide').executes((ctx) => {
      let player = ctx.source.playerOrException
      player.server.runCommandSilent(`open-patchouli-book ${player.username} ${GUIDE_BOOK}`)
      return 1
    })
  )
})
