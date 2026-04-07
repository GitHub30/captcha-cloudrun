# captcha-cloudrun

## Deploy
```bash
gcloud run deploy captcha --source . --function hello --base-image python312 --region asia-northeast1
```

## `xserver_captcha.keras` を `web_model` に変換する手順

### 1. `tensorflowjs` をインストール
```bash
cd /workspaces/captcha-cloudrun
python -m pip install tensorflowjs
```

### 2. `.keras` を一度 `.h5` に変換
```bash
python - <<'PY'
import tensorflow as tf

model = tf.keras.models.load_model('xserver_captcha.keras')
model.save('xserver_captcha.h5')
print('saved h5')
PY
```

### 3. TensorFlow.js 形式へ変換
```bash
/usr/local/python/3.12.1/bin/tensorflowjs_converter \
  --input_format=keras \
  xserver_captcha.h5 \
  web_model
```

生成物:
- `web_model/model.json`
- `web_model/group1-shard1of3.bin`
- `web_model/group1-shard2of3.bin`
- `web_model/group1-shard3of3.bin`

### 補足
Keras 3 の出力をそのままブラウザで使うと互換性エラーが出ることがあるため、今回の `web_model/model.json` は TensorFlow.js 互換になるよう追加調整しています。
