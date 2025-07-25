# captcha-cloudrun

Deploy
```bash
# test
gcloud run deploy captcha-test --source . --function hello --base-image python312 --region asia-southeast1
# production
gcloud run deploy captcha --source . --function hello --base-image python312 --region asia-northeast1
```