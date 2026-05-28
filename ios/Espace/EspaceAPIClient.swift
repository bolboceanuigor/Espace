import Foundation

final class EspaceAPIClient {
    static let shared = EspaceAPIClient(baseURL: AppConfig.defaultAPIBaseURL)

    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    func login(email: String, password: String) async throws -> AuthPayload {
        try await post("auth/login", body: LoginBody(email: email, password: password), token: nil)
    }

    func demoLogin() async throws -> AuthPayload {
        try await post("auth/demo-login", body: EmptyBody(), token: nil)
    }

    func me(token: String) async throws -> MePayload {
        try await get("me", token: token)
    }

    func residentHome(token: String) async throws -> ResidentHome {
        try await get("resident/home", token: token)
    }

    func invoices(token: String) async throws -> PaginatedResponse<ResidentInvoice> {
        try await get("resident/invoices", query: [URLQueryItem(name: "limit", value: "50")], token: token)
    }

    func meters(token: String) async throws -> [ResidentMeter] {
        try await get("resident/meters", token: token)
    }

    func issues(token: String) async throws -> [ResidentIssue] {
        try await get("resident/issues", token: token)
    }

    func announcements(token: String) async throws -> [Announcement] {
        try await get("resident/announcements", token: token)
    }

    @discardableResult
    func createIssue(
        token: String,
        title: String,
        description: String,
        category: String = "OTHER",
        priority: String = "NORMAL",
        apartmentId: String? = nil
    ) async throws -> ResidentIssue {
        let body = CreateIssueBody(
            title: title,
            description: description,
            category: category,
            priority: priority,
            apartmentId: apartmentId
        )
        return try await post("resident/issues", body: body, token: token)
    }

    private func get<T: Decodable>(
        _ path: String,
        query: [URLQueryItem] = [],
        token: String?
    ) async throws -> T {
        try await request(path, method: "GET", query: query, bodyData: nil, token: token)
    }

    private func post<T: Decodable, Body: Encodable>(
        _ path: String,
        body: Body,
        token: String?
    ) async throws -> T {
        try await request(path, method: "POST", query: [], bodyData: encoder.encode(body), token: token)
    }

    private func request<T: Decodable>(
        _ path: String,
        method: String,
        query: [URLQueryItem],
        bodyData: Data?,
        token: String?
    ) async throws -> T {
        var components = URLComponents(url: makeURL(path), resolvingAgainstBaseURL: false)
        components?.queryItems = query.isEmpty ? nil : query

        guard let url = components?.url else { throw EspaceAPIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Espace-iOS/1.0", forHTTPHeaderField: "User-Agent")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = bodyData

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw EspaceAPIError.invalidResponse
        }

        guard 200..<300 ~= httpResponse.statusCode else {
            throw decodeError(from: data, statusCode: httpResponse.statusCode)
        }

        return try decodePayload(T.self, from: data)
    }

    private func makeURL(_ path: String) -> URL {
        let base = baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let trimmedPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: "\(base)/\(trimmedPath)")!
    }

    private func decodePayload<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        if let envelope = try? decoder.decode(APIEnvelope<T>.self, from: data), let payload = envelope.data {
            return payload
        }
        return try decoder.decode(T.self, from: data)
    }

    private func decodeError(from data: Data, statusCode: Int) -> EspaceAPIError {
        if let envelope = try? decoder.decode(APIEnvelope<EmptyResponse>.self, from: data) {
            return .server(statusCode: statusCode, message: envelope.error?.message ?? envelope.message)
        }
        if let payload = try? decoder.decode(APIErrorPayload.self, from: data) {
            return .server(statusCode: statusCode, message: payload.message)
        }
        return .server(statusCode: statusCode, message: nil)
    }
}

private struct LoginBody: Encodable {
    let email: String
    let password: String
}

private struct EmptyBody: Encodable {}
private struct EmptyResponse: Decodable {}

enum EspaceAPIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case server(statusCode: Int, message: String?)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            "URL API invalid."
        case .invalidResponse:
            "Raspuns API invalid."
        case .server(let statusCode, let message):
            message?.nonEmpty ?? "API a raspuns cu status \(statusCode)."
        }
    }
}
