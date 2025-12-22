import axios from "axios";

const API_URL = "http://localhost:8080/api/itens";

export function cadastrarItem(item){
    return axios.post(API_URL, item);
}