import Foundation
import Observation

@MainActor
@Observable
final class SessionStore {
    @ObservationIgnored private let api: EspaceAPIClient
    @ObservationIgnored private let tokenStore: TokenStore

    private(set) var token: String?
    private(set) var user: EspaceUser?
    private(set) var home: ResidentHome?
    private(set) var invoices: [ResidentInvoice] = []
    private(set) var meters: [ResidentMeter] = []
    private(set) var issues: [ResidentIssue] = []
    private(set) var announcements: [Announcement] = []
    var isLoading = false
    var isRefreshing = false
    var errorMessage: String?

    var isAuthenticated: Bool { token != nil }

    init(api: EspaceAPIClient, tokenStore: TokenStore) {
        self.api = api
        self.tokenStore = tokenStore
        self.token = tokenStore.loadToken()
    }

    func restore() async {
        guard let token else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            user = try await api.me(token: token).user
            try await loadResidentData(token: token)
        } catch {
            logout()
            errorMessage = "Sesiunea a expirat. Autentifica-te din nou."
        }
    }

    func login(email: String, password: String) async {
        await authenticate {
            try await api.login(email: email, password: password)
        }
    }

    func demoLogin() async {
        await authenticate {
            try await api.demoLogin()
        }
    }

    func refreshAll() async {
        guard let token else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        do {
            try await loadResidentData(token: token)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @discardableResult
    func createIssue(title: String, description: String, apartmentId: String?) async -> Bool {
        guard let token else { return false }

        do {
            let issue = try await api.createIssue(
                token: token,
                title: title,
                description: description,
                apartmentId: apartmentId
            )
            issues.insert(issue, at: 0)
            await refreshAll()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func logout() {
        tokenStore.deleteToken()
        token = nil
        user = nil
        home = nil
        invoices = []
        meters = []
        issues = []
        announcements = []
    }

    private func authenticate(_ action: () async throws -> AuthPayload) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let payload = try await action()
            try tokenStore.saveToken(payload.accessToken)
            token = payload.accessToken
            user = payload.user
            try await loadResidentData(token: payload.accessToken)
        } catch {
            logout()
            errorMessage = error.localizedDescription
        }
    }

    private func loadResidentData(token: String) async throws {
        async let nextHome = api.residentHome(token: token)
        async let nextInvoices = api.invoices(token: token)
        async let nextMeters = api.meters(token: token)
        async let nextIssues = api.issues(token: token)
        async let nextAnnouncements = api.announcements(token: token)

        home = try await nextHome
        invoices = try await nextInvoices.items
        meters = try await nextMeters
        issues = try await nextIssues
        announcements = try await nextAnnouncements
    }
}
