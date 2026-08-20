import os
from dotenv import load_dotenv
load_dotenv()

import google.generativeai as genai

key = os.getenv("GEMINI_API_KEY")
print("Key length:", len(key) if key else 0)

try:
    genai.configure(api_key=key)
    generation_config = genai.GenerationConfig(temperature=0.7)
    selected_model = "models/gemini-2.5-flash"

    model = genai.GenerativeModel(
        model_name=selected_model,
        system_instruction="You are a helpful assistant."
    )

    response = model.generate_content(
        "what is ai",
        generation_config=generation_config,
        stream=True
    )

    for chunk in response:
        print(chunk.text)
except Exception as e:
    import traceback
    traceback.print_exc()

