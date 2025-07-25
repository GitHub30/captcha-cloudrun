import tensorflow as tf

headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "*",
}

model = None

def load_model():
    global model
    if model is None:
        print('model loading...')
        model = tf.keras.models.load_model('xserver_captcha.keras')
    return model

def hello(request):
    if request.method != 'POST':
        return '', 200, headers
    data_url = request.get_data(as_text=True)
    img = tf.io.decode_base64(data_url.split(',')[-1].translate(str.maketrans({'+':'-','/':'_'})))
    img = tf.image.decode_png(img, channels=3)
    img = tf.image.resize(img, [60, 300]) / 255.0
    batch = tf.expand_dims(img, 0)
    preds = load_model()(batch)
    input_len = tf.fill([tf.shape(preds)[0]], tf.shape(preds)[1])
    decoded = tf.keras.backend.ctc_decode(preds, input_length=input_len, greedy=True)[0][0]
    code = ''.join(str(c) for c in decoded.numpy()[0] if c >= 0)
    return code, 200, headers
