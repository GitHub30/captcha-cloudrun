[Local Inference Demo](https://github30.github.io/captcha-cloudrun/)

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

## TensorFlow.js 互換になるよう調整した内容の詳細

Keras 3 から変換した直後の `model.json` は、そのままだとブラウザ側の `tf.loadLayersModel()` で読み込めない箇所がありました。今回行った主な調整は以下です。

### 1. `InputLayer` のキー名を変更
Keras 3 側では次のように出力されることがありました。

```json
{
  "class_name": "InputLayer",
  "config": {
    "batch_shape": [null, 60, 300, 3]
  }
}
```

しかし TensorFlow.js 側は `batch_shape` ではなく、`batch_input_shape` または `inputShape` を期待します。
そのため以下のように変更しています。

```json
{
  "class_name": "InputLayer",
  "config": {
    "batch_input_shape": [null, 60, 300, 3]
  }
}
```

これをしないと、次のエラーが発生しました。

```text
An InputLayer should be passed either a `batchInputShape` or an `inputShape`.
```

### 2. `dtype` の表現を簡略化
Keras 3 の JSON では `dtype` が `DTypePolicy` オブジェクトとして出力されることがあります。

例:

```json
"dtype": {
  "module": "keras",
  "class_name": "DTypePolicy",
  "config": { "name": "float32" }
}
```

TensorFlow.js ではこの形式をそのまま扱えないことがあるため、単純な文字列に変換しています。

```json
"dtype": "float32"
```

### 3. `inbound_nodes` を旧 TensorFlow.js 互換形式に変換
Keras 3 ではレイヤー接続情報がオブジェクト形式で出力されることがあります。

例:

```json
"inbound_nodes": [
  {
    "args": [
      {
        "class_name": "__keras_tensor__",
        "config": {
          "keras_history": ["input_image", 0, 0]
        }
      }
    ],
    "kwargs": {}
  }
]
```

TensorFlow.js の `tfjs-layers` は、より古い配列表現を期待するため、以下の形式に変換しています。

```json
"inbound_nodes": [
  [
    ["input_image", 0, 0, {}]
  ]
]
```

これを行わないと、次のようなエラーが発生しました。

```text
Corrupted configuration, expected array for nodeData
```

### 4. 不要なメタ情報を除去
Keras 3 が付与する以下のような情報は、TensorFlow.js 側で不要または互換性問題の原因になることがありました。

- `module`
- `registered_name`
- `build_config`

そのため、`modelTopology` 内から不要なメタ情報を整理しています。

### 5. `Bidirectional/LSTM` の weight 名を TensorFlow.js に合わせて修正
変換直後の `weightsManifest` には、例えば以下のような名前が入っていました。

```json
"forward_lstm/lstm_cell/kernel"
```

一方、TensorFlow.js が実際に期待していた名前は次のような形式でした。

```json
"bilstm1/forward_forward_lstm/kernel"
```

この差異があると、次のエラーが発生しました。

```text
Provided weight data has no target variable: forward_lstm/lstm_cell/kernel
```

そのため、`weightsManifest.weights[].name` を TensorFlow.js 側の実際の変数名に合わせて修正しています。

主な対応例:

- `forward_lstm/lstm_cell/kernel`
  → `bilstm1/forward_forward_lstm/kernel`
- `backward_lstm/lstm_cell/kernel`
  → `bilstm1/backward_forward_lstm/kernel`
- `forward_lstm_1/lstm_cell/kernel`
  → `bilstm2/forward_forward_lstm_1/kernel`
- `backward_lstm_1/lstm_cell/kernel`
  → `bilstm2/backward_forward_lstm_1/kernel`

### 6. キャッシュ回避のためクエリ文字列を付与
ブラウザが古い `model.json` をキャッシュしてしまうと、修正後の内容が反映されないことがあります。
そのため `index.html` 側では次のようにクエリ文字列付きで読み込むようにしています。

```javascript
await tf.loadLayersModel('./web_model/model.json?v=20260407-2')
```

### 7. 修正後の確認
最終的に以下の内容を確認できました。

- `tf.loadLayersModel()` が成功する
- 入力 shape が `[null, 60, 300, 3]`
- 出力 shape が `[null, 19, 11]`
- ダミー入力 `tf.zeros([1, 60, 300, 3])` で `predict()` が成功する

つまり、現在の `web_model` はブラウザ側だけで推論できる TensorFlow.js 用モデルとして利用可能です。
