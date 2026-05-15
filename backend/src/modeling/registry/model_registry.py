from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Lasso, LinearRegression, LogisticRegression, Ridge
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import PolynomialFeatures
from sklearn.svm import SVR
from sklearn.tree import DecisionTreeRegressor
from xgboost import XGBRegressor

from src.modeling.registry.model_specs import (
    PROBLEM_TYPES,
    ModelConfig,
    choices,
    float_range,
    int_range,
)


def make_polynomial_pipeline(**params):
    return Pipeline(
        [
            (
                "poly",
                PolynomialFeatures(
                    degree=params.pop("poly__degree", 2),
                    include_bias=params.pop("poly__include_bias", False),
                ),
            ),
            (
                "linear",
                LinearRegression(
                    fit_intercept=params.pop("linear__fit_intercept", True),
                ),
            ),
        ]
    )


MODEL_CONFIGS = (
    ModelConfig(
        id="linear-regression",
        name="Linear Regression",
        category="Linear Models",
        problem_type="regression",
        estimator=LinearRegression,
        primary_metric="r2",
        search_spaces=({"fit_intercept": choices(True, False)},),
        secondary_metrics=("neg_mean_absolute_error", "neg_root_mean_squared_error"),
        simplicity_score=5.0,
        interpretability_score=5.0,
        scalability_score=5.0,
    ),
    ModelConfig(
        id="polynomial-regression",
        name="Polynomial Regression",
        category="Feature Expansion Linear Models",
        problem_type="regression",
        builder=make_polynomial_pipeline,
        primary_metric="r2",
        default_params={
            "poly__degree": 2,
            "poly__include_bias": False,
            "linear__fit_intercept": True,
        },
        search_spaces=(
            {
                "poly__degree": choices(2, 3, 4),
                "linear__fit_intercept": choices(True, False),
            },
        ),
        secondary_metrics=("neg_mean_absolute_error", "neg_root_mean_squared_error"),
        simplicity_score=2.25,
        interpretability_score=2.5,
        scalability_score=2.75,
    ),
    ModelConfig(
        id="lasso-regression",
        name="Lasso Regression",
        category="Regularized Linear Models",
        problem_type="regression",
        estimator=Lasso,
        primary_metric="r2",
        search_spaces=(
            {
                "alpha": choices(0.0001, 0.001, 0.01, 0.1, 1.0, 10.0),
                "max_iter": choices(1000, 3000, 5000),
            },
        ),
        secondary_metrics=("neg_mean_absolute_error", "neg_root_mean_squared_error"),
        simplicity_score=4.25,
        interpretability_score=4.5,
        scalability_score=4.75,
    ),
    ModelConfig(
        id="ridge-regression",
        name="Ridge Regression",
        category="Regularized Linear Models",
        problem_type="regression",
        estimator=Ridge,
        primary_metric="r2",
        search_spaces=(
            {
                "alpha": choices(0.0001, 0.001, 0.01, 0.1, 1.0, 10.0, 100.0),
                "solver": choices("auto", "svd", "cholesky", "lsqr"),
            },
        ),
        secondary_metrics=("neg_mean_absolute_error", "neg_root_mean_squared_error"),
        simplicity_score=4.5,
        interpretability_score=4.75,
        scalability_score=5.0,
    ),
    ModelConfig(
        id="decision-tree-regression",
        name="Decision Tree Regression",
        category="Tree Models",
        problem_type="regression",
        estimator=DecisionTreeRegressor,
        primary_metric="r2",
        default_params={"random_state": 42},
        search_spaces=(
            {
                "criterion": choices("squared_error", "friedman_mse", "absolute_error"),
                "max_depth": int_range(2, 24, validation_values=[2, 4, 6, 8, 12, 16, 20, 24]),
                "min_samples_split": int_range(2, 20, validation_values=[2, 4, 6, 8, 10, 14, 20]),
                "min_samples_leaf": int_range(1, 10, validation_values=[1, 2, 3, 4, 6, 8, 10]),
                "max_features": choices(None, "sqrt", "log2"),
                "ccp_alpha": float_range(
                    1e-6,
                    1e-1,
                    log=True,
                    validation_values=[1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 5e-2, 1e-1],
                ),
            },
        ),
        secondary_metrics=("neg_mean_absolute_error", "neg_root_mean_squared_error"),
        simplicity_score=3.5,
        interpretability_score=4.5,
        scalability_score=3.5,
    ),
    ModelConfig(
        id="random-forest-regression",
        name="Random Forest Regression",
        category="Tree Ensembles",
        problem_type="regression",
        estimator=RandomForestRegressor,
        primary_metric="r2",
        default_params={"random_state": 42, "n_jobs": 1},
        search_spaces=(
            {
                "n_estimators": int_range(
                    100, 800, validation_values=[100, 200, 300, 400, 600, 800]
                ),
                "max_depth": int_range(3, 24, validation_values=[3, 5, 8, 12, 16, 20, 24]),
                "min_samples_split": int_range(2, 20, validation_values=[2, 4, 6, 8, 10, 14, 20]),
                "min_samples_leaf": int_range(1, 10, validation_values=[1, 2, 3, 4, 6, 8, 10]),
                "max_features": choices(1.0, "sqrt", "log2", 0.5),
                "bootstrap": choices(True, False),
            },
        ),
        secondary_metrics=("neg_mean_absolute_error", "neg_root_mean_squared_error"),
        simplicity_score=2.25,
        interpretability_score=2.0,
        scalability_score=3.75,
    ),
    ModelConfig(
        id="xgboost-regression",
        name="XGBoost Regression",
        category="Boosting",
        problem_type="regression",
        estimator=XGBRegressor,
        primary_metric="r2",
        default_params={
            "objective": "reg:squarederror",
            "tree_method": "hist",
            "verbosity": 0,
            "random_state": 42,
            "n_jobs": 1,
        },
        search_spaces=(
            {
                "n_estimators": int_range(
                    100, 800, validation_values=[100, 200, 300, 500, 650, 800]
                ),
                "max_depth": int_range(3, 10, validation_values=[3, 4, 5, 6, 8, 10]),
                "learning_rate": float_range(
                    0.01, 0.3, log=True, validation_values=[0.01, 0.02, 0.05, 0.08, 0.12, 0.2, 0.3]
                ),
                "min_child_weight": int_range(1, 10, validation_values=[1, 2, 3, 5, 7, 10]),
                "subsample": float_range(
                    0.5, 1.0, validation_values=[0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
                ),
                "colsample_bytree": float_range(
                    0.5, 1.0, validation_values=[0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
                ),
                "reg_alpha": float_range(
                    1e-8, 10.0, log=True, validation_values=[1e-8, 1e-6, 1e-4, 1e-2, 0.1, 1.0, 10.0]
                ),
                "reg_lambda": float_range(
                    1e-3, 20.0, log=True, validation_values=[1e-3, 1e-2, 1e-1, 1.0, 5.0, 10.0, 20.0]
                ),
                "gamma": float_range(
                    1e-8, 5.0, log=True, validation_values=[1e-8, 1e-6, 1e-4, 1e-2, 0.1, 1.0, 5.0]
                ),
            },
        ),
        secondary_metrics=("neg_mean_absolute_error", "neg_root_mean_squared_error"),
        simplicity_score=1.5,
        interpretability_score=1.25,
        scalability_score=4.25,
    ),
    ModelConfig(
        id="svr",
        name="Support Vector Regression (SVR)",
        category="Kernel Methods",
        problem_type="regression",
        estimator=SVR,
        primary_metric="r2",
        default_params={
            "kernel": "rbf",
            "C": 1.0,
            "epsilon": 0.1,
            "gamma": "scale",
        },
        search_spaces=(
            {
                "kernel": choices("linear"),
                "C": choices(0.1, 1.0, 10.0, 100.0),
                "epsilon": choices(0.01, 0.1, 0.5),
            },
            {
                "kernel": choices("rbf"),
                "C": choices(0.1, 1.0, 10.0, 100.0),
                "epsilon": choices(0.01, 0.1, 0.5),
                "gamma": choices("scale", "auto", 0.01, 0.1, 1.0),
            },
            {
                "kernel": choices("poly"),
                "C": choices(0.1, 1.0, 10.0, 100.0),
                "epsilon": choices(0.01, 0.1, 0.5),
                "gamma": choices("scale", "auto", 0.01, 0.1),
                "degree": choices(2, 3, 4),
                "coef0": choices(0.0, 0.5, 1.0),
            },
        ),
        secondary_metrics=("neg_mean_absolute_error", "neg_root_mean_squared_error"),
        simplicity_score=1.75,
        interpretability_score=1.5,
        scalability_score=1.75,
    ),
    ModelConfig(
        id="logistic-regression",
        name="Logistic Regression",
        category="Linear Models",
        problem_type="classification",
        estimator=LogisticRegression,
        primary_metric="f1_weighted",
        default_params={"max_iter": 1000},
        search_spaces=(
            {
                "C": choices(0.01, 0.1, 1.0, 10.0, 100.0),
                "solver": choices("lbfgs", "liblinear"),
            },
        ),
        secondary_metrics=("accuracy", "precision_weighted", "recall_weighted"),
        simplicity_score=4.75,
        interpretability_score=5.0,
        scalability_score=5.0,
    ),
    ModelConfig(
        id="naive-bayes-classifier",
        name="Naive Bayes",
        category="Probabilistic Models",
        problem_type="classification",
        estimator=GaussianNB,
        primary_metric="f1_weighted",
        search_spaces=(
            {
                "var_smoothing": choices(1e-12, 1e-11, 1e-10, 1e-9, 1e-8),
            },
        ),
        secondary_metrics=("accuracy", "precision_weighted", "recall_weighted"),
        simplicity_score=4.75,
        interpretability_score=4.25,
        scalability_score=5.0,
    ),
    ModelConfig(
        id="knn-classifier",
        name="K-Nearest Neighbors",
        category="Neighbors",
        problem_type="classification",
        estimator=KNeighborsClassifier,
        primary_metric="f1_weighted",
        search_spaces=(
            {
                "n_neighbors": choices(3, 5, 7, 9, 11, 15),
                "weights": choices("uniform", "distance"),
                "p": choices(1, 2),
            },
        ),
        secondary_metrics=("accuracy", "precision_weighted", "recall_weighted"),
        simplicity_score=3.0,
        interpretability_score=3.0,
        scalability_score=1.75,
    ),
)


MODEL_CONFIGS_BY_ID = {model.id: model for model in MODEL_CONFIGS}


def get_model_config(model_id):
    model = MODEL_CONFIGS_BY_ID.get(model_id)
    if model is None:
        raise ValueError(f"Model '{model_id}' not found in registry.")

    return model


def get_registry_item(model_id):
    return get_model_config(model_id).to_dict()


def get_models_by_problem_type(problem_type):
    if problem_type not in PROBLEM_TYPES:
        raise ValueError(f"Unsupported problem_type: {problem_type}")

    return [model.to_dict() for model in MODEL_CONFIGS if model.problem_type == problem_type]


def build_estimator(model_id):
    return get_model_config(model_id).build_estimator()
