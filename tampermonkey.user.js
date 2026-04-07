// ==UserScript==
// @name         InferCode
// @namespace    http://tampermonkey.net/
// @version      2026-04-07
// @description  try to take over the world!
// @author       You
// @match        https://example.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=example.com
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js
// @grant        none
// ==/UserScript==
/* global tf */

(async function() {
    'use strict';

    function loadImage(base64imageURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
            img.src = base64imageURL;
        });
    }

    function decodeCaptcha(predictionTensor) {
        const blankIndex = predictionTensor.shape[2] - 1;
        const bestPath = predictionTensor.argMax(-1).dataSync();
        const digits = [];
        let previous = blankIndex;

        for (const index of bestPath) {
            if (index !== blankIndex && index !== previous) {
                digits.push(String(index));
            }
            previous = index;
        }

        return digits.join('');
    }


    async function imageToCode(img) {
        await tf.ready()
        const model = await tf.loadLayersModel('https://github30.github.io/captcha-cloudrun/web_model/model.json?v=20260407-2')
        return tf.tidy(() => {
            const tensor = tf.browser
            .fromPixels(img)
            .resizeBilinear([60, 300])
            .toFloat()
            .div(255)
            .expandDims(0);
            return decodeCaptcha(model.predict(tensor))
        });
    }

    const base64image_url = 'data:image/jpeg;base64,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';

    try {
        const img = await loadImage(base64image_url)
        console.time()
        const code = await imageToCode(img)
        console.timeEnd()
        console.log(code)
    } catch (error) {
        console.error('imageToCode failed:', error)
    }
})()
