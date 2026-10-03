import pandas as pd

from src.models.model_loader import ModelBundle, load_models


def predict_blood_demand_and_shortage(input_data: dict, models: ModelBundle | None = None) -> dict:
    """
    Predict future blood demand and shortage risk.

    Parameters
    ----------
    input_data : dict
        Blood-bank information required by the trained models.

    Returns
    -------
    dict
        Predicted demand and shortage risk.
    """

    models = models or load_models()
    input_df = pd.DataFrame([input_data])

    predicted_demand = models.demand_model.predict(input_df)[0]

    predicted_risk_encoded = models.shortage_model.predict(input_df)[0]

    predicted_risk = models.label_encoder.inverse_transform(
        [int(predicted_risk_encoded)]
    )[0]

    return {
        "predicted_demand": round(float(predicted_demand), 2),
        "shortage_risk": predicted_risk,
    }