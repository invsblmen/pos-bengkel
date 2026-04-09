package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type partSaleCreateFromOrderRequest struct {
	SalesOrderID int64  `json:"sales_order_id"`
	ActorUserID  *int64 `json:"actor_user_id"`
}

func partSaleCreateFromOrderHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSON(w, http.StatusServiceUnavailable, response{"message": "database is not configured"})
			return
		}

		var payload partSaleCreateFromOrderRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, response{"message": "invalid json payload"})
			return
		}

		if payload.SalesOrderID <= 0 {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"sales_order_id": []string{"The sales order id field is required."},
				},
			})
			return
		}

		exists, err := recordExists(db, "part_sales_orders", payload.SalesOrderID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, response{"message": "failed to read sales order"})
			return
		}
		if !exists {
			writeJSON(w, http.StatusUnprocessableEntity, response{
				"message": "The given data was invalid.",
				"errors": response{
					"sales_order_id": []string{"Selected sales order id is invalid."},
				},
			})
			return
		}

		writeJSON(w, http.StatusOK, response{
			"ok":             true,
			"sales_order_id": payload.SalesOrderID,
		})
	}
}
