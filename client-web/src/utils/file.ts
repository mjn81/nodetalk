import { init, compress, decompress } from '@bokuweb/zstd-wasm';

let isZstdReady = false;

/**
 * Ensures the ZSTD WASM module is initialized.
 */
export async function ensureZstdReady() {
	if (!isZstdReady) {
		// Vite will bundle the .wasm file and provide the correct path/buffer
		await init();
		isZstdReady = true;
	}
}

/**
 * Generates a small WebP thumbnail from an image file.
 */
async function generateThumbnail(
	file: File,
	maxWidth = 400,
	maxHeight = 400,
): Promise<Uint8Array | null> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				let width = img.width;
				let height = img.height;

				if (width > height) {
					if (width > maxWidth) {
						height *= maxWidth / width;
						width = maxWidth;
					}
				} else {
					if (height > maxHeight) {
						width *= maxHeight / height;
						height = maxHeight;
					}
				}

				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) return resolve(null);

				ctx.drawImage(img, 0, 0, width, height);
				canvas.toBlob(
					(blob) => {
						if (!blob) return resolve(null);
						const reader = new FileReader();
						reader.onloadend = () => {
							resolve(new Uint8Array(reader.result as ArrayBuffer));
						};
						reader.readAsArrayBuffer(blob);
					},
					'image/webp',
					0.8,
				);
			};
			img.src = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	});
}

/**
 * Generates a small WebP thumbnail from a video file at 1 second.
 */
async function generateVideoThumbnail(file: File, maxWidth = 400, maxHeight = 400): Promise<Uint8Array | null> {
	return new Promise((resolve) => {
		const video = document.createElement('video');
		const url = URL.createObjectURL(file);
		video.src = url;
		video.preload = 'metadata';
		video.muted = true;
		video.playsInline = true;

		video.onloadeddata = () => {
			// Small delay to ensure frames are ready, seek to 1s
			video.currentTime = Math.min(1, video.duration || 0);
		};

		video.onseeked = () => {
			const canvas = document.createElement('canvas');
			let width = video.videoWidth;
			let height = video.videoHeight;

			if (width > height) {
				if (width > maxWidth) {
					height *= maxWidth / width;
					width = maxWidth;
				}
			} else {
				if (height > maxHeight) {
					width *= maxHeight / height;
					height = maxHeight;
				}
			}

			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) return resolve(null);

			ctx.drawImage(video, 0, 0, width, height);
			canvas.toBlob((blob) => {
				URL.revokeObjectURL(url);
				if (!blob) return resolve(null);
				const reader = new FileReader();
				reader.onloadend = () => {
					resolve(new Uint8Array(reader.result as ArrayBuffer));
				};
				reader.readAsArrayBuffer(blob);
			}, 'image/webp', 0.8);
		};

		video.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(null);
		};
	});
}

/**
 * Prepares a file for secure upload:
 * 1. Compresses the raw bytes using ZSTD via WASM.
 * 2. Encrypts the compressed bytes using AES-256-GCM and the channel key.
 * 3. Generates a low-res thumbnail if the file is an image.
 */
export async function encryptAndCompressFile(
	file: File,
	channelKey: Uint8Array,
): Promise<{
	ciphertext: Uint8Array;
	nonce: Uint8Array;
	thumbnailCipher?: Uint8Array;
	thumbnailNonce?: Uint8Array;
	mimeType: string;
	originalSize: number;
}> {
	await ensureZstdReady();

	const arrayBuffer = await file.arrayBuffer();
	const compressed = compress(new Uint8Array(arrayBuffer), 10);

	// Import channel key for encryption
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		channelKey.buffer as ArrayBuffer,
		'AES-GCM',
		false,
		['encrypt'],
	);

	// Encrypt main file
	const nonce = crypto.getRandomValues(new Uint8Array(12));
	const ciphertextBuffer = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: nonce as any },
		cryptoKey,
		compressed as any,
	);

	const result: any = {
		ciphertext: new Uint8Array(ciphertextBuffer),
		nonce: nonce,
		mimeType: file.type,
		originalSize: file.size,
	};

	// thumbnail (exclude HEIC/HEIF as browsers can't render them natively)
	if (
		file.type.startsWith('image/') &&
		!file.type.includes('heic') &&
		!file.type.includes('heif')
	) {
		const thumb = await generateThumbnail(file);
		if (thumb) {
			const thumbNonce = crypto.getRandomValues(new Uint8Array(12));
			const thumbCipher = await crypto.subtle.encrypt(
				{ name: 'AES-GCM', iv: thumbNonce as any },
				cryptoKey,
				thumb as any,
			);
			result.thumbnailCipher = new Uint8Array(thumbCipher);
			result.thumbnailNonce = thumbNonce;
		}
	}

	// thumbnail for videos
	if (file.type.startsWith('video/')) {
		const thumb = await generateVideoThumbnail(file);
		if (thumb) {
			const thumbNonce = crypto.getRandomValues(new Uint8Array(12));
			const thumbCipher = await crypto.subtle.encrypt(
				{ name: 'AES-GCM', iv: thumbNonce as any },
				cryptoKey,
				thumb as any,
			);
			result.thumbnailCipher = new Uint8Array(thumbCipher);
			result.thumbnailNonce = thumbNonce;
		}
	}

	return result;
}

/**
 * Decrypts and decompresses a file:
 * 1. Decrypts using AES-256-GCM.
 * 2. Decompresses using ZSTD via WASM.
 */
export async function decryptAndDecompressFile(
	ciphertext: Uint8Array,
	nonce: Uint8Array,
	channelKey: Uint8Array,
): Promise<Uint8Array> {
	await ensureZstdReady();

	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		channelKey.buffer as ArrayBuffer,
		'AES-GCM',
		false,
		['decrypt'],
	);

	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: nonce as any },
		cryptoKey,
		ciphertext as any,
	);

	const decompressed = decompress(new Uint8Array(decrypted));
	return decompressed;
}
