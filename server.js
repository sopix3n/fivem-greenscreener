/// <reference types="@citizenfx/server" />
/// <reference types="image-js" />

const imagejs = require('image-js');
const fs = require('fs');
const path = require('path');

const resName = GetCurrentResourceName();
const mainSavePath = path.join(GetResourcePath(resName), 'images');

// Ensure directory exists
try {
	if (!fs.existsSync(mainSavePath)) {
		fs.mkdirSync(mainSavePath, { recursive: true });
		console.log(`[${resName}] Created images directory: ${mainSavePath}`);
	}
} catch (error) {
	console.error(`[${resName}] Error creating directory:`, error.message);
}

onNet('takeScreenshot', async (filename, type) => {
	const source = global.source;
	const savePath = path.join(mainSavePath, type);
	
	try {
		// Create type directory if it doesn't exist
		if (!fs.existsSync(savePath)) {
			fs.mkdirSync(savePath, { recursive: true });
		}
		
		const fileName = path.join(savePath, filename + '.png');
		
		exports['screenshot-basic'].requestClientScreenshot(
			source,
			{
				fileName: fileName,
				encoding: 'png',
				quality: 1.0,
			},
			async (err, savedFileName) => {
				if (err) {
					console.error(`[${resName}] Screenshot error:`, err);
					return;
				}
				
				try {
					let image = await imagejs.Image.load(savedFileName);
					const croppedImage = image.crop({ x: image.width / 4.5, width: image.height });

					image.data = croppedImage.data;
					image.width = croppedImage.width;
					image.height = croppedImage.height;

					// Process green screen removal
					for (let x = 0; x < image.width; x++) {
						for (let y = 0; y < image.height; y++) {
							const pixelArr = image.getPixelXY(x, y);
							const r = pixelArr[0];
							const g = pixelArr[1];
							const b = pixelArr[2];

							// Remove green pixels (make transparent)
							if (g > r + b) {
								image.setPixelXY(x, y, [255, 255, 255, 0]);
							}
						}
					}

					await image.save(savedFileName);
					
					// Log to Discord webhook
					const webhook = GetConvar("discord_greenscreen_webhook", "");
					if (webhook && webhook !== "") {
						const playerName = GetPlayerName(source);
						const playerId = GetPlayerIdentifier(source, 0);
						
						const embed = {
							title: "Greenscreen Image Generated",
							description: `**Player:** ${playerName} (${playerId})\n**Type:** ${type}\n**Filename:** ${filename}.png`,
							color: 0x00ff00,
							timestamp: new Date().toISOString(),
							footer: {
								text: "Sandbox Greenscreen"
							}
						};
						
						PerformHttpRequest(webhook, function(err, text, headers) {
							if (err) {
								console.error(`[${resName}] Discord webhook error:`, err);
							}
						}, 'POST', json.encode({
							content: "",
							embeds: [embed]
						}), {
							'Content-Type': 'application/json'
						});
					}
					
					console.log(`[${resName}] Successfully processed image: ${savedFileName}`);
					
				} catch (imageError) {
					console.error(`[${resName}] Image processing error:`, imageError.message);
				}
			}
		);
	} catch (error) {
		console.error(`[${resName}] General error:`, error.message);
	}
});

on('onResourceStart', (resource) => {
	if (resource === GetCurrentResourceName()) {
		console.log(`[${resName}] Greenscreen resource loaded - commands available via original RegisterCommand`);
	}
});

console.log(`[${resName}] Greenscreen resource loaded successfully`);
