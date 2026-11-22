import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
     presets: [
          presetUno(),
          presetAttributify(),
          presetIcons(),
     ],
     dark: 'class',
     theme: {
          colors: {
               whiteMode: "#202020",
          },
     },
})
