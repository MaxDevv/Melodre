import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: true,
			host: '0.0.0.0', // Change this to a valid IP address if needed
			port: 5173, // Optional otherwise your app will start on default port
		}
});
