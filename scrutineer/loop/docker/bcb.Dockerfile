# Sandbox image for BigCodeBench-Hard.
#
# Versions are pinned to a 2024-era scientific stack because the benchmark was written against
# one. On current pandas its own reference solutions fail: `DataFrame.applymap` is gone, the 'Q'
# frequency alias is gone, StringDtype no longer coerces the same way. Those are not candidate
# errors, they are the oracle breaking, and a task whose reference fails cannot score anything.
#
# Nothing here relaxes the sandbox: it still runs --network none, read-only, memory and CPU capped.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc g++ libglib2.0-0 libgl1 \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
      "numpy==1.26.4" "pandas==2.2.3" "scipy==1.13.1" "scikit-learn==1.5.2" \
      "matplotlib==3.9.2" "seaborn==0.13.2" "statsmodels==0.14.4" \
      beautifulsoup4 lxml pyquery requests chardet \
      flask flask-login flask-wtf flask-mail wtforms werkzeug \
      openpyxl python-docx pytz python-dateutil rsa pycryptodome cryptography \
      opencv-python-headless nltk psutil texttable wordninja python-Levenshtein \
      faker sympy pillow

# nltk corpora must be baked in: the sandbox has no network, so a task that downloads at runtime
# fails for reasons that have nothing to do with the code under test
RUN python -c "import nltk; [nltk.download(p, quiet=True) for p in \
      ('punkt','punkt_tab','stopwords','wordnet','averaged_perceptron_tagger','omw-1.4')]"

ENV MPLBACKEND=Agg
