import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    // Дозволяємо доступ з будь-яких хостів, щоб ngrok не блокувався
    allowedHosts: true, 
    host: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        deposit: resolve(__dirname, 'deposit.html'),
        game1: resolve(__dirname, 'game1.html'),
        game2: resolve(__dirname, 'game2.html'),
        piastria: resolve(__dirname, 'piastria.html'),
      },
    },
  },
});